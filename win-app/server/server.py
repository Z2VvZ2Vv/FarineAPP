"""
Windows app server — FarineAPP
==============================

C'est le système principal (tablette Windows). Il :

    • sert l'application web (win-app/app) ;
    • possède les rations, sessions, logs et l'état global ;
    • interroge le serveur RPi pour le poids et la tare ;
    • pilote les moteurs via le boîtier Shelly Pro 2.

Deux dépendances matérielles, séparées et repérables plus bas :

    • La BALANCE passe toujours par le serveur RPi (HTTP) — qui, lui, simule ou
      lit la vraie Flintec.
    • Les MOTEURS (Shelly) ont deux mondes nets :
          - SIMULATION → fonctionne aujourd'hui, sans matériel ;
          - RÉEL       → appel HTTP au Shelly Pro 2, à brancher/vérifier.

Bascule des moteurs via  config.json → shelly.simulation  (true/false).
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
from datetime import datetime, timezone
import json
import mimetypes
import os
import threading
import urllib.parse
import urllib.request


# =============================================================================
#  Chemins & configuration
# =============================================================================

BASE_DIR = Path(__file__).resolve().parent
WIN_APP_DIR = BASE_DIR.parent
APP_DIR = WIN_APP_DIR / "app"
DATA_DIR = BASE_DIR / "data"
RATIONS_DIR = DATA_DIR / "rations"
CONFIG_FILE = BASE_DIR / "config.json"
STATE_FILE = DATA_DIR / "state.json"
LOGS_FILE = DATA_DIR / "logs.json"

lock = threading.Lock()


DEFAULT_STATE = {
    "mix": {
        "inProgress": False,
        "recipeID": None,
        "recipe": None,
        "totalWeight": 0.0,
        "sessionStart": None,
        "sessionId": None,
    },
    "lastWeight": {
        "value": 0.0,
        "unit": "kg",
        "stable": True,
        "source": "not-read-yet",
    },
    "motors": {
        "corn": False,
        "alfalfa": False,
    },
    "hardware": {
        "rpiConnected": False,
        "rpiLastError": None,
        "shellyConnected": False,
        "shellyLastError": None,
    },
}

DEFAULT_LOGS = {
    "total_usage": {},
    "monthly_usage": {},
    "sessions": [],
}


def load_config():
    return read_json(CONFIG_FILE, {
        "host": "0.0.0.0",
        "port": 8080,
        "rpiSerialServerUrl": "http://127.0.0.1:7001",
        "shelly": {
            "simulation": True,
            "baseUrl": "http://192.168.33.1",
            "relayMap": {"corn": 0, "alfalfa": 1},
        },
        "weightPollMs": 1000,
    })


# =============================================================================
#  Persistance & utilitaires
# =============================================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def today():
    return datetime.now().strftime("%Y-%m-%d")


def month_key():
    return datetime.now().strftime("%Y-%m")


def read_json(path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        pass
    return json.loads(json.dumps(default))


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw) if raw else {}


def send_json(handler, status, payload):
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(encoded)


CONFIG = load_config()
state = read_json(STATE_FILE, DEFAULT_STATE)


# =============================================================================
#  Fichiers statiques (l'application web)
# =============================================================================

def send_static(handler, relative_path):
    base = APP_DIR.resolve()
    rel = relative_path.lstrip("/") or "index.html"
    target = (base / rel).resolve()
    if target.is_dir():
        target = target / "index.html"
    if not str(target).startswith(str(base)) or not target.exists():
        target = base / "index.html"
    data = target.read_bytes()
    content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


# =============================================================================
#  Rations (recettes) — stockées en fichiers JSON
# =============================================================================

def recipe_file_name(name):
    safe = "".join(ch for ch in name.strip() if ch not in '\\/:*?"<>|').replace(" ", "_")
    return f"{safe}.json"


def recipe_path(name):
    return RATIONS_DIR / recipe_file_name(name)


def list_recipes():
    RATIONS_DIR.mkdir(parents=True, exist_ok=True)
    recipes = []
    for path in sorted(RATIONS_DIR.glob("*.json")):
        try:
            recipes.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return recipes


def get_recipe(name):
    decoded = unquote(name)
    path = recipe_path(decoded)
    if path.exists():
        return read_json(path, None)
    for recipe in list_recipes():
        if recipe.get("name") == decoded:
            return recipe
    return None


def validate_recipe(recipe):
    if not isinstance(recipe, dict):
        return "Recipe must be an object"
    if not str(recipe.get("name", "")).strip():
        return "Recipe name is required"
    ingredients = recipe.get("ingredients")
    if not isinstance(ingredients, list) or not ingredients:
        return "At least one ingredient is required"
    total = 0.0
    for ingredient in ingredients:
        if not str(ingredient.get("name", "")).strip():
            return "Ingredient name is required"
        try:
            percentage = float(ingredient.get("percentage"))
        except (TypeError, ValueError):
            return "Ingredient percentage must be a number"
        if percentage < 0:
            return "Ingredient percentage cannot be negative"
        total += percentage
    if abs(total - 100.0) > 0.01:
        return f"Ingredient percentages must total 100. Current total is {total:g}"
    return None


# =============================================================================
#  Pont vers le serveur RPi (balance)
# -----------------------------------------------------------------------------
#  La balance n'est jamais touchée directement ici : on parle au serveur RPi en
#  HTTP. C'est LUI qui simule ou lit la vraie Flintec.
# =============================================================================

def http_json(method, url, body=None, timeout=1.5):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def rpi_url(path):
    return str(CONFIG.get("rpiSerialServerUrl", "")).rstrip("/") + path


def rpi_request(method, path, body=None):
    return http_json(method, rpi_url(path), body=body)


def mark_rpi(ok, error=None):
    state["hardware"]["rpiConnected"] = ok
    state["hardware"]["rpiLastError"] = error


def get_weight():
    try:
        payload = rpi_request("GET", "/api/weight")
        state["lastWeight"] = payload
        mark_rpi(True, None)
    except Exception as exc:
        mark_rpi(False, str(exc))
        payload = {
            **state["lastWeight"],
            "source": "last-known-weight",
            "error": str(exc),
        }
    write_json(STATE_FILE, state)
    return payload


def tare_scale():
    # "Faire la tare" : remet l'affichage à zéro (mémorise le poids du contenant).
    try:
        payload = rpi_request("POST", "/api/tare", {})
        mark_rpi(True, None)
        if "weight" in payload:
            state["lastWeight"] = payload["weight"]
        write_json(STATE_FILE, state)
        return payload
    except Exception as exc:
        mark_rpi(False, str(exc))
        write_json(STATE_FILE, state)
        return {"ok": False, "error": str(exc)}


def untare_scale():
    # "Retirer la tare" : annule le zéro, on réaffiche le poids brut.
    try:
        payload = rpi_request("POST", "/api/tare/reset", {})
        mark_rpi(True, None)
        if "weight" in payload:
            state["lastWeight"] = payload["weight"]
        write_json(STATE_FILE, state)
        return payload
    except Exception as exc:
        mark_rpi(False, str(exc))
        write_json(STATE_FILE, state)
        return {"ok": False, "error": str(exc)}


def set_rpi_simulation_filling(active):
    # Pousse la simulation de remplissage côté RPi quand un moteur tourne.
    # Sans effet si le RPi est en mode réel.
    path = "/api/simulation/fill/start" if active else "/api/simulation/fill/stop"
    try:
        rpi_request("POST", path, {})
    except Exception:
        pass


# =============================================================================
#  Moteurs (Shelly Pro 2)
# =============================================================================

def mark_shelly(ok, error=None):
    state["hardware"]["shellyConnected"] = ok
    state["hardware"]["shellyLastError"] = error


def shelly_switch(motor, on):
    """Aiguillage simulation / réel pour un moteur. Le reste du serveur
    n'appelle QUE cette fonction."""
    shelly = CONFIG.get("shelly", {})
    relay_id = shelly.get("relayMap", {}).get(motor)
    if relay_id is None:
        raise RuntimeError(f"No Shelly relay configured for {motor}")

    if shelly.get("simulation", True):
        return shelly_switch_simulation(motor, on)
    return shelly_switch_real(motor, on, relay_id)


# -----------------------------------------------------------------------------
#  MONDE SIMULÉ — pas de Shelly, on bouge juste l'état et on fait monter le
#  poids simulé côté RPi. Fonctionne aujourd'hui.
# -----------------------------------------------------------------------------

def shelly_switch_simulation(motor, on):
    state["motors"][motor] = bool(on)
    mark_shelly(False, "Shelly simulation mode")
    set_rpi_simulation_filling(any(state["motors"].values()))
    write_json(STATE_FILE, state)
    return {"ok": True, "simulation": True, "motors": state["motors"]}


# -----------------------------------------------------------------------------
#  MONDE RÉEL — Shelly Pro 2 sur le WiFi.
#
#  Appel HTTP au relais (API RPC Gen2). À vérifier/ajuster quand le boîtier
#  sera branché :
#      - config.json → shelly.simulation = false
#      - config.json → shelly.baseUrl    = http://<ip-du-shelly>
#      - config.json → shelly.relayMap   = {"corn": 0, "alfalfa": 1}
# -----------------------------------------------------------------------------

def shelly_switch_real(motor, on, relay_id):
    base_url = str(CONFIG.get("shelly", {}).get("baseUrl", "")).rstrip("/")
    query = urllib.parse.urlencode({"id": relay_id, "on": "true" if on else "false"})

    http_json("GET", f"{base_url}/rpc/Switch.Set?{query}")

    state["motors"][motor] = bool(on)
    mark_shelly(True, None)
    set_rpi_simulation_filling(any(state["motors"].values()))
    write_json(STATE_FILE, state)
    return {"ok": True, "simulation": False, "motors": state["motors"]}


# =============================================================================
#  Logs & sessions
# =============================================================================

def update_logs(recipe, target_weight, final_weight, completed):
    logs = read_json(LOGS_FILE, DEFAULT_LOGS)
    logs.setdefault("total_usage", {})
    logs.setdefault("monthly_usage", {})
    logs.setdefault("sessions", [])
    month = month_key()
    logs["monthly_usage"].setdefault(month, {})

    effective = float(target_weight if completed else min(final_weight, target_weight))
    for ingredient in recipe.get("ingredients", []):
        name = ingredient["name"]
        used = round((float(ingredient["percentage"]) / 100.0) * effective, 2)

        total_entry = logs["total_usage"].setdefault(name, {
            "total_kg": 0.0,
            "total_sessions": 0,
            "first_used": today(),
            "last_used": today(),
        })
        total_entry["total_kg"] = round(float(total_entry["total_kg"]) + used, 2)
        total_entry["total_sessions"] = int(total_entry["total_sessions"]) + 1
        total_entry["last_used"] = today()

        month_entry = logs["monthly_usage"][month].setdefault(name, {
            "total_kg": 0.0,
            "sessions": 0,
        })
        month_entry["total_kg"] = round(float(month_entry["total_kg"]) + used, 2)
        month_entry["sessions"] = int(month_entry["sessions"]) + 1

    logs["sessions"].append({
        "id": state["mix"].get("sessionId"),
        "recipeName": recipe.get("name"),
        "targetWeight": target_weight,
        "finalWeight": round(float(final_weight), 1),
        "completed": completed,
        "startedAt": state["mix"].get("sessionStart"),
        "endedAt": now_iso(),
    })
    write_json(LOGS_FILE, logs)
    return logs


def stop_mix(completed=False):
    mix = state["mix"]
    final_weight = float(state["lastWeight"].get("value") or 0.0)

    for motor in list(state["motors"].keys()):
        try:
            shelly_switch(motor, False)
        except Exception as exc:
            mark_shelly(False, str(exc))
    set_rpi_simulation_filling(False)

    if not mix.get("inProgress"):
        write_json(STATE_FILE, state)
        return {"ok": True, "message": "No mix in progress", "finalWeight": final_weight}

    recipe = mix.get("recipe")
    target_weight = float(mix.get("totalWeight") or 0.0)
    if recipe:
        update_logs(recipe, target_weight, final_weight, completed)

    state["mix"] = DEFAULT_STATE["mix"].copy()
    write_json(STATE_FILE, state)
    return {"ok": True, "completed": completed, "finalWeight": round(final_weight, 1)}


# =============================================================================
#  Serveur HTTP
# =============================================================================

class WinAppServerHandler(BaseHTTPRequestHandler):
    server_version = "FarineWinAppServer/0.1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        send_json(self, 200, {"ok": True})

    # ---- Lectures ----------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            send_static(self, path)
            return

        with lock:
            if path == "/api/health":
                send_json(self, 200, {"ok": True, "service": "win-app-server", "time": now_iso()})
                return

            if path == "/api/status":
                send_json(self, 200, {
                    "ok": True,
                    "state": state,
                    "config": {
                        "rpiSerialServerUrl": CONFIG.get("rpiSerialServerUrl"),
                        "shellySimulation": CONFIG.get("shelly", {}).get("simulation"),
                        "weightPollMs": CONFIG.get("weightPollMs"),
                    },
                })
                return

            if path == "/api/recipes":
                send_json(self, 200, list_recipes())
                return

            if path.startswith("/api/recipes/"):
                recipe = get_recipe(path.split("/api/recipes/", 1)[1])
                if recipe is None:
                    send_json(self, 404, {"error": "Recipe not found"})
                    return
                send_json(self, 200, recipe)
                return

            if path == "/api/logs":
                send_json(self, 200, {"resource_usage": read_json(LOGS_FILE, DEFAULT_LOGS), "timestamp": now_iso()})
                return

            if path == "/api/weight":
                send_json(self, 200, get_weight())
                return

            if path == "/api/mix/status":
                send_json(self, 200, {
                    **state["mix"],
                    "currentWeight": state["lastWeight"],
                    "motors": state["motors"],
                    "hardware": state["hardware"],
                })
                return

            if path == "/api/motors/status":
                send_json(self, 200, {"motors": state["motors"], "hardware": state["hardware"]})
                return

        send_json(self, 404, {"error": "Not found"})

    # ---- Écritures ---------------------------------------------------------

    def do_POST(self):
        self.handle_mutation("POST")

    def do_PUT(self):
        self.handle_mutation("PUT")

    def do_DELETE(self):
        self.handle_mutation("DELETE")

    def handle_mutation(self, method):
        path = urlparse(self.path).path
        try:
            body = read_body(self) if method != "DELETE" else {}
        except json.JSONDecodeError:
            send_json(self, 400, {"error": "Invalid JSON"})
            return

        with lock:

            # --- Rations : créer ---
            if path == "/api/recipes" and method == "POST":
                error = validate_recipe(body)
                if error:
                    send_json(self, 400, {"error": error})
                    return
                body["name"] = body["name"].strip()
                body.setdefault("created_at", now_iso())
                target = recipe_path(body["name"])
                if target.exists():
                    send_json(self, 409, {"error": "Recipe already exists"})
                    return
                write_json(target, body)
                send_json(self, 201, body)
                return

            # --- Rations : modifier / supprimer ---
            if path.startswith("/api/recipes/"):
                name = unquote(path.split("/api/recipes/", 1)[1])
                target = recipe_path(name)

                if method == "DELETE":
                    if not target.exists():
                        send_json(self, 404, {"error": "Recipe not found"})
                        return
                    target.unlink()
                    send_json(self, 200, {"ok": True})
                    return

                if method == "PUT":
                    if not target.exists():
                        send_json(self, 404, {"error": "Recipe not found"})
                        return
                    error = validate_recipe(body)
                    if error:
                        send_json(self, 400, {"error": error})
                        return
                    existing = read_json(target, {})
                    body["created_at"] = existing.get("created_at", now_iso())
                    body["updated_at"] = now_iso()
                    body["name"] = body["name"].strip()
                    new_target = recipe_path(body["name"])
                    if new_target != target and new_target.exists():
                        send_json(self, 409, {"error": "Recipe already exists"})
                        return
                    if new_target != target:
                        target.unlink()
                    write_json(new_target, body)
                    send_json(self, 200, body)
                    return

            # --- Balance : faire / retirer la tare ---
            if path == "/api/tare" and method == "POST":
                send_json(self, 200, tare_scale())
                return

            if path == "/api/tare/reset" and method == "POST":
                send_json(self, 200, untare_scale())
                return

            # --- Ration en cours : démarrer ---
            if path == "/api/mix/start" and method == "POST":
                if state["mix"].get("inProgress"):
                    send_json(self, 400, {"error": "A mix is already in progress"})
                    return
                recipe = body.get("recipe")
                if not recipe and body.get("recipeName"):
                    recipe = get_recipe(body["recipeName"])
                try:
                    total_weight = float(body.get("totalWeight") or 0)
                except (TypeError, ValueError):
                    total_weight = 0.0
                if not recipe:
                    send_json(self, 400, {"error": "Recipe is required"})
                    return
                if total_weight <= 0:
                    send_json(self, 400, {"error": "totalWeight must be greater than 0"})
                    return
                try:
                    rpi_request("POST", "/api/simulation/reset", {})
                    mark_rpi(True, None)
                except Exception as exc:
                    mark_rpi(False, str(exc))
                session_id = now_iso()
                state["mix"] = {
                    "inProgress": True,
                    "recipeID": recipe["name"],
                    "recipe": recipe,
                    "totalWeight": total_weight,
                    "sessionStart": session_id,
                    "sessionId": session_id,
                }
                state["lastWeight"] = {"value": 0.0, "unit": "kg", "stable": True, "source": "mix-start"}
                write_json(STATE_FILE, state)
                send_json(self, 200, state["mix"])
                return

            # --- Ration en cours : arrêter / terminer ---
            if path == "/api/mix/stop" and method == "POST":
                send_json(self, 200, stop_mix(completed=False))
                return

            if path == "/api/mix/complete" and method == "POST":
                send_json(self, 200, stop_mix(completed=True))
                return

            # --- Moteurs : les deux d'un coup ---
            if path in ("/api/motors/all/on", "/api/motors/all/off") and method == "POST":
                enabled = path.endswith("/on")
                results = {}
                for motor in state["motors"]:
                    try:
                        results[motor] = shelly_switch(motor, enabled)
                    except Exception as exc:
                        results[motor] = {"ok": False, "error": str(exc)}
                send_json(self, 200, {"ok": True, "motors": state["motors"], "results": results})
                return

            # --- Moteurs : un seul (on / off / toggle) ---
            motor_action = path.split("/")
            if len(motor_action) == 5 and motor_action[:3] == ["", "api", "motors"] and method == "POST":
                motor = motor_action[3]
                action = motor_action[4]
                if motor not in state["motors"]:
                    send_json(self, 404, {"error": "Unknown motor"})
                    return
                try:
                    if action == "on":
                        result = shelly_switch(motor, True)
                    elif action == "off":
                        result = shelly_switch(motor, False)
                    elif action == "toggle":
                        result = shelly_switch(motor, not state["motors"][motor])
                    else:
                        send_json(self, 404, {"error": "Unknown motor action"})
                        return
                    send_json(self, 200, result)
                except Exception as exc:
                    mark_shelly(False, str(exc))
                    write_json(STATE_FILE, state)
                    send_json(self, 503, {"error": str(exc), "motors": state["motors"]})
                return

        send_json(self, 404, {"error": "Not found"})


# =============================================================================
#  Démarrage
# =============================================================================

if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RATIONS_DIR.mkdir(parents=True, exist_ok=True)
    host = os.environ.get("WIN_APP_HOST", CONFIG.get("host", "0.0.0.0"))
    port = int(os.environ.get("WIN_APP_PORT", CONFIG.get("port", 8080)))
    server = ThreadingHTTPServer((host, port), WinAppServerHandler)
    print(f"FarineAPP Windows server listening on http://{host}:{port}")
    print(f"Tablet app/admin: http://127.0.0.1:{port}/")
    print(f"RPi serial server: {CONFIG.get('rpiSerialServerUrl')}")
    print(f"Moteurs Shelly: {'SIMULATION' if CONFIG.get('shelly', {}).get('simulation') else 'RÉEL'}")
    server.serve_forever()
