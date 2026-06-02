from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import random
import threading
import time
from datetime import datetime, timezone


HOST = os.environ.get("RPI_SERIAL_HOST", "0.0.0.0")
PORT = int(os.environ.get("RPI_SERIAL_PORT", "7001"))
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
        "lastCommandAt": None
    },
    "simulation": {
        "fillActive": False,
        "lastTickAt": None
    }
}


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


state = read_json(STATE_FILE, DEFAULT_STATE)


def tick_weight():
    sim = state["simulation"]
    if sim.get("fillActive"):
        state["grossWeight"] = float(state.get("grossWeight", 0.0)) + random.uniform(2.5, 18.0)
    else:
        state["grossWeight"] = max(0.0, float(state.get("grossWeight", 0.0)) + random.uniform(-0.15, 0.15))
    state["stable"] = random.choices([True, False], weights=[0.84, 0.16])[0]
    sim["lastTickAt"] = now_iso()


def current_weight():
    tick_weight()
    value = max(0.0, float(state["grossWeight"]) - float(state["tareOffset"]))
    write_json(STATE_FILE, state)
    return {
        "value": round(value, 1),
        "unit": "kg",
        "stable": state["stable"],
        "source": "rpi-serial-simulation",
        "time": now_iso()
    }


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


class RpiSerialHandler(BaseHTTPRequestHandler):
    server_version = "FarineRpiSerialServer/0.1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        send_json(self, 200, {"ok": True})

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path in ("/", "/api/health"):
            send_json(self, 200, {
                "ok": True,
                "service": "rpi-serial-server",
                "time": now_iso()
            })
            return

        if path == "/api/status":
            with lock:
                send_json(self, 200, {
                    "ok": True,
                    "serial": state["serial"],
                    "simulation": state["simulation"],
                    "weight": {
                        "grossWeight": round(float(state["grossWeight"]), 1),
                        "tareOffset": round(float(state["tareOffset"]), 1),
                        "stable": state["stable"]
                    }
                })
            return

        if path == "/api/weight":
            with lock:
                send_json(self, 200, current_weight())
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
                        payload = current_weight()
                    message = "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
                    self.wfile.write(message.encode("utf-8"))
                    self.wfile.flush()
                    time.sleep(1)
            except (BrokenPipeError, ConnectionResetError):
                return

        send_json(self, 404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            body = read_body(self)
        except json.JSONDecodeError:
            send_json(self, 400, {"error": "Invalid JSON"})
            return

        with lock:
            if path == "/api/tare":
                state["tareOffset"] = float(state.get("grossWeight", 0.0))
                state["serial"]["lastCommand"] = "TARE"
                state["serial"]["lastCommandAt"] = now_iso()
                write_json(STATE_FILE, state)
                send_json(self, 200, {
                    "ok": True,
                    "message": "Tare command simulated",
                    "weight": current_weight()
                })
                return

            if path == "/api/serial/command":
                command = str(body.get("command", "")).strip()
                if not command:
                    send_json(self, 400, {"error": "command is required"})
                    return
                state["serial"]["lastCommand"] = command
                state["serial"]["lastCommandAt"] = now_iso()
                write_json(STATE_FILE, state)
                send_json(self, 200, {
                    "ok": True,
                    "message": "Serial command simulated",
                    "command": command
                })
                return

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
                send_json(self, 200, {"ok": True, "weight": current_weight()})
                return

        send_json(self, 404, {"error": "Not found"})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), RpiSerialHandler)
    print(f"RPi serial server listening on http://{HOST}:{PORT}")
    print("Responsibilities: stream weight and send tare/serial commands to Flintec.")
    print("Current mode: simulated serial and simulated weight.")
    server.serve_forever()
