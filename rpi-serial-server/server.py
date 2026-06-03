"""
RPi serial server — FarineAPP
=============================

Rôle unique : faire le pont entre la balance Flintec (port série USB) et le
réseau. Il EXPOSE le poids et ENVOIE des commandes de tare. C'est tout.

Il ne gère NI moteurs, NI rations, NI logs, NI sessions (ça, c'est le serveur
Windows).

Deux mondes, volontairement séparés plus bas :

    • SIMULATION  → fonctionne aujourd'hui, sans aucun matériel.
    • RÉEL        → à coder quand la balance Flintec sera branchée.

Bascule via la variable d'environnement :

    RPI_SIMULATION = 1   (par défaut)  → simulation
    RPI_SIMULATION = 0                 → balance réelle
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timezone
import json
import os
import random
import threading
import time


# =============================================================================
#  Configuration
# =============================================================================

HOST = os.environ.get("RPI_SERIAL_HOST", "0.0.0.0")
PORT = int(os.environ.get("RPI_SERIAL_PORT", "7001"))

# True  → poids et tare simulés (aucun matériel requis).
# False → on parle à la vraie balance Flintec (section "MONDE RÉEL" plus bas).
SIMULATION = os.environ.get("RPI_SIMULATION", "1").strip().lower() not in ("0", "false", "no")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATE_FILE = DATA_DIR / "state.json"

lock = threading.Lock()


DEFAULT_STATE = {
    "grossWeight": 0.0,
    "tareOffset": 0.0,
    "stable": True,
    "serial": {
        "enabled": False,
        "port": None,
        "lastCommand": None,
        "lastCommandAt": None,
    },
    "simulation": {
        "fillActive": False,
        "lastTickAt": None,
    },
}


# =============================================================================
#  Persistance & utilitaires
# =============================================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def read_json(path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        pass
    return json.loads(json.dumps(default))


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(encoded)


state = read_json(STATE_FILE, DEFAULT_STATE)


# =============================================================================
#  MONDE SIMULÉ  —  poids & tare simulés (mode par défaut)
# -----------------------------------------------------------------------------
#  Tout ce bloc est jetable : il imite une balance pour développer l'appli sans
#  matériel. Quand le "fill" est actif (moteurs en marche côté Windows), le
#  poids monte ; sinon il oscille légèrement autour de sa valeur.
# =============================================================================

def sim_tick_weight():
    sim = state["simulation"]
    if sim.get("fillActive"):
        state["grossWeight"] = float(state.get("grossWeight", 0.0)) + random.uniform(2.5, 18.0)
    else:
        state["grossWeight"] = max(0.0, float(state.get("grossWeight", 0.0)) + random.uniform(-0.15, 0.15))
    state["stable"] = random.choices([True, False], weights=[0.84, 0.16])[0]
    sim["lastTickAt"] = now_iso()


def sim_read_weight():
    sim_tick_weight()
    tare_offset = float(state["tareOffset"])
    value = max(0.0, float(state["grossWeight"]) - tare_offset)
    write_json(STATE_FILE, state)
    return {
        "value": round(value, 1),
        "unit": "kg",
        "stable": state["stable"],
        "tared": tare_offset > 0.0,           # True si une tare est active
        "source": "rpi-serial-simulation",
        "time": now_iso(),
    }


def sim_send_tare():
    # "Faire la tare" : on mémorise le poids brut actuel comme zéro de référence.
    state["tareOffset"] = float(state.get("grossWeight", 0.0))
    state["serial"]["lastCommand"] = "TARE"
    state["serial"]["lastCommandAt"] = now_iso()
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Tare simulée", "weight": sim_read_weight()}


def sim_remove_tare():
    # "Retirer la tare" : on remet l'offset à zéro -> on réaffiche le poids brut.
    state["tareOffset"] = 0.0
    state["serial"]["lastCommand"] = "TARE_RESET"
    state["serial"]["lastCommandAt"] = now_iso()
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Tare retirée", "weight": sim_read_weight()}


def sim_send_serial_command(command):
    state["serial"]["lastCommand"] = command
    state["serial"]["lastCommandAt"] = now_iso()
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Commande série simulée", "command": command}


# =============================================================================
#  MONDE RÉEL  —  balance Flintec sur port série USB
# -----------------------------------------------------------------------------
#  À CODER quand la balance sera branchée. Pistes :
#
#      - pip install pyserial
#      - ouvrir le port une seule fois au démarrage
#        (ex : serial.Serial("/dev/ttyUSB0", 9600, timeout=1))
#      - lire et parser les trames de poids Flintec -> float kg
#      - traduire la tare en commande série Flintec
#
#  Laisse les corps de fonction se remplir le moment venu (garde le même
#  format de retour que la version simulée).
# =============================================================================

# serial_port = None  # ouvrir ici au démarrage quand l'infra sera là


def real_read_weight():
    # TODO: lire le poids réel sur le port série Flintec.
    #       Retourner: {"value": ..., "unit": "kg", "stable": ..., "tared": bool, "source": "rpi-serial", "time": now_iso()}
    raise NotImplementedError("Lecture série Flintec à implémenter")


def real_send_tare():
    # TODO: envoyer la commande de tare réelle à la Flintec.
    raise NotImplementedError("Tare série Flintec à implémenter")


def real_remove_tare():
    # TODO: annuler la tare réelle (revenir au poids brut) sur la Flintec.
    raise NotImplementedError("Retrait de tare série Flintec à implémenter")


def real_send_serial_command(command):
    # TODO: envoyer une commande série brute à la Flintec.
    raise NotImplementedError("Commande série Flintec à implémenter")


# =============================================================================
#  Aiguillage simulation / réel
# -----------------------------------------------------------------------------
#  Le reste du serveur n'appelle QUE ces trois fonctions. Le choix sim/réel est
#  centralisé ici, nulle part ailleurs.
# =============================================================================

def read_weight():
    return sim_read_weight() if SIMULATION else real_read_weight()


def send_tare():
    return sim_send_tare() if SIMULATION else real_send_tare()


def remove_tare():
    return sim_remove_tare() if SIMULATION else real_remove_tare()


def send_serial_command(command):
    return sim_send_serial_command(command) if SIMULATION else real_send_serial_command(command)


# =============================================================================
#  Serveur HTTP
# =============================================================================

class RpiSerialHandler(BaseHTTPRequestHandler):
    server_version = "FarineRpiSerialServer/0.1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        send_json(self, 200, {"ok": True})

    # ---- Lectures ----------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path in ("/", "/api/health"):
            send_json(self, 200, {
                "ok": True,
                "service": "rpi-serial-server",
                "simulation": SIMULATION,
                "time": now_iso(),
            })
            return

        if path == "/api/status":
            with lock:
                send_json(self, 200, {
                    "ok": True,
                    "simulation": SIMULATION,
                    "serial": state["serial"],
                    "simulationState": state["simulation"],
                    "weight": {
                        "grossWeight": round(float(state["grossWeight"]), 1),
                        "tareOffset": round(float(state["tareOffset"]), 1),
                        "stable": state["stable"],
                    },
                })
            return

        if path == "/api/weight":
            with lock:
                send_json(self, 200, read_weight())
            return

        if path == "/api/weight/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                while True:
                    with lock:
                        payload = read_weight()
                    message = "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
                    self.wfile.write(message.encode("utf-8"))
                    self.wfile.flush()
                    time.sleep(1)
            except (BrokenPipeError, ConnectionResetError):
                return

        send_json(self, 404, {"error": "Not found"})

    # ---- Commandes ---------------------------------------------------------

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            body = read_body(self)
        except json.JSONDecodeError:
            send_json(self, 400, {"error": "Invalid JSON"})
            return

        with lock:
            if path == "/api/tare":
                send_json(self, 200, send_tare())
                return

            if path == "/api/tare/reset":
                send_json(self, 200, remove_tare())
                return

            if path == "/api/serial/command":
                command = str(body.get("command", "")).strip()
                if not command:
                    send_json(self, 400, {"error": "command is required"})
                    return
                send_json(self, 200, send_serial_command(command))
                return

            # --- Contrôles propres à la simulation (no-op côté balance réelle) ---

            if path == "/api/simulation/fill/start":
                state["simulation"]["fillActive"] = True
                write_json(STATE_FILE, state)
                send_json(self, 200, {"ok": True, "simulation": state["simulation"]})
                return

            if path == "/api/simulation/fill/stop":
                state["simulation"]["fillActive"] = False
                write_json(STATE_FILE, state)
                send_json(self, 200, {"ok": True, "simulation": state["simulation"]})
                return

            if path == "/api/simulation/reset":
                state["grossWeight"] = 0.0
                state["tareOffset"] = 0.0
                state["simulation"]["fillActive"] = False
                write_json(STATE_FILE, state)
                send_json(self, 200, {"ok": True, "weight": read_weight()})
                return

        send_json(self, 404, {"error": "Not found"})


# =============================================================================
#  Démarrage
# =============================================================================

if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), RpiSerialHandler)
    print(f"RPi serial server listening on http://{HOST}:{PORT}")
    print("Rôle : exposer le poids et envoyer la tare à la Flintec.")
    print(f"Mode  : {'SIMULATION (poids/tare simulés)' if SIMULATION else 'RÉEL (balance Flintec série)'}")
    server.serve_forever()
