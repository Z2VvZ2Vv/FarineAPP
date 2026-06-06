"""
FarineAPP RPi serial server.

Responsibility:
  - expose the Flintec FT-111 weight over HTTP;
  - send tare / clear-tare commands to the FT-111 over USB serial;
  - keep a simulation mode for development.

The Windows tablet can run this same server for bench tests. On the final RPi,
only the serial port name usually changes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import random
import re
import threading
import time


# =============================================================================
# Configuration
# =============================================================================

HOST = os.environ.get("RPI_SERIAL_HOST", "0.0.0.0")
PORT = int(os.environ.get("RPI_SERIAL_PORT", "7001"))

SIMULATION = os.environ.get("RPI_SIMULATION", "1").strip().lower() not in ("0", "false", "no")

FLINTEC_PORT = os.environ.get("FLINTEC_PORT", "").strip()
FLINTEC_BAUDRATE = int(os.environ.get("FLINTEC_BAUDRATE", "9600"))
FLINTEC_PARITY = os.environ.get("FLINTEC_PARITY", "N").strip().upper()[:1] or "N"
FLINTEC_BYTESIZE = int(os.environ.get("FLINTEC_BYTESIZE", "8"))
FLINTEC_STOPBITS = os.environ.get("FLINTEC_STOPBITS", "1").strip()
FLINTEC_TIMEOUT = float(os.environ.get("FLINTEC_TIMEOUT", "1.2"))

# The FT-111 continuous frame seen on USB is currently:
#   STX S+00000009 NUL CR LF
# The connected indicator display shows 9 kg for this frame, so the current
# setup uses zero protocol decimals. Keep it configurable for other indicators.
FLINTEC_DECIMALS = int(os.environ.get("FLINTEC_DECIMALS", "0"))
FLINTEC_UNIT = os.environ.get("FLINTEC_UNIT", "kg")

# FT-111 manual: sending ASCII P/Z/T/C acts like the related key is pressed.
# Keep these configurable because some setups use BSI commands such as 01T.
FLINTEC_TARE_COMMAND = os.environ.get("FLINTEC_TARE_COMMAND", "T")
FLINTEC_CLEAR_COMMAND = os.environ.get("FLINTEC_CLEAR_COMMAND", "C")
FLINTEC_ZERO_COMMAND = os.environ.get("FLINTEC_ZERO_COMMAND", "Z")
FLINTEC_COMMAND_SUFFIX = os.environ.get("FLINTEC_COMMAND_SUFFIX", "")

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
        "lastFrame": None,
        "lastParsedAt": None,
        "lastCommand": None,
        "lastCommandAt": None,
        "lastError": None,
        "tareActive": None,
    },
    "simulation": {
        "fillActive": False,
        "lastTickAt": None,
    },
}


# =============================================================================
# Persistence / HTTP helpers
# =============================================================================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path, default):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        pass
    return json.loads(json.dumps(default))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def read_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    return json.loads(raw) if raw else {}


def send_json(handler, status: int, payload) -> None:
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
# Simulation
# =============================================================================

def sim_tick_weight() -> None:
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
        "rawValue": round(value, 3),
        "unit": "kg",
        "stable": state["stable"],
        "tared": tare_offset > 0.0,
        "source": "rpi-serial-simulation",
        "time": now_iso(),
    }


def sim_send_tare():
    state["tareOffset"] = float(state.get("grossWeight", 0.0))
    state["serial"]["lastCommand"] = "TARE"
    state["serial"]["lastCommandAt"] = now_iso()
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Tare simulée", "weight": sim_read_weight()}


def sim_remove_tare():
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
# Real Flintec FT-111 serial client
# =============================================================================

class FlintecFrameError(RuntimeError):
    pass


class FlintecSerialClient:
    _continuous_re = re.compile(rb"\x02?([A-Za-z])([+-])([0-9]{4,})(?:\x00)?\r?\n")
    _bsi_weight_re = re.compile(rb"([0-9]{2})[A-Z]([A-Z])([+-])([0-9]+(?:\.[0-9]+)?)")

    def __init__(self) -> None:
        self._serial = None
        self._serial_module = None
        self._port_name = None

    def _import_serial(self):
        if self._serial_module is not None:
            return self._serial_module
        try:
            import serial  # type: ignore
            import serial.tools.list_ports  # type: ignore
        except ImportError as exc:
            raise RuntimeError("pyserial is required in real mode: python -m pip install pyserial") from exc
        self._serial_module = serial
        return serial

    def list_ports(self):
        serial = self._import_serial()
        return list(serial.tools.list_ports.comports())

    def choose_port(self) -> str:
        if FLINTEC_PORT:
            return FLINTEC_PORT

        ports = self.list_ports()
        if not ports:
            raise RuntimeError("No serial ports found")

        def score(port):
            text = " ".join(str(x or "") for x in (port.device, port.description, port.hwid)).lower()
            value = 0
            if "c251" in text and "2205" in text:
                value += 100
            if "usb serial" in text:
                value += 50
            if "flintec" in text:
                value += 50
            if "ttyusb" in text or "ttyacm" in text:
                value += 40
            if "intel" in text or "active management" in text or "sol" in text:
                value -= 100
            return value

        best = sorted(ports, key=score, reverse=True)[0]
        return best.device

    def _open(self):
        serial = self._import_serial()
        if self._serial is not None and self._serial.is_open:
            return self._serial

        port_name = self.choose_port()
        parity = {
            "N": serial.PARITY_NONE,
            "E": serial.PARITY_EVEN,
            "O": serial.PARITY_ODD,
        }.get(FLINTEC_PARITY, serial.PARITY_NONE)
        stopbits = {
            "1": serial.STOPBITS_ONE,
            "1.5": serial.STOPBITS_ONE_POINT_FIVE,
            "2": serial.STOPBITS_TWO,
        }.get(FLINTEC_STOPBITS, serial.STOPBITS_ONE)

        self._serial = serial.Serial(
            port=port_name,
            baudrate=FLINTEC_BAUDRATE,
            bytesize=FLINTEC_BYTESIZE,
            parity=parity,
            stopbits=stopbits,
            timeout=FLINTEC_TIMEOUT,
            write_timeout=FLINTEC_TIMEOUT,
        )
        self._port_name = port_name
        state["serial"]["enabled"] = True
        state["serial"]["port"] = port_name
        state["serial"]["lastError"] = None
        return self._serial

    def close(self) -> None:
        try:
            if self._serial is not None and self._serial.is_open:
                self._serial.close()
        finally:
            self._serial = None

    def _read_bytes(self, duration: float = 1.25) -> bytes:
        ser = self._open()
        end = time.monotonic() + duration
        chunks = []
        while time.monotonic() < end:
            waiting = getattr(ser, "in_waiting", 0)
            if waiting:
                chunks.append(ser.read(waiting))
                if b"\n" in chunks[-1]:
                    break
            else:
                chunk = ser.read(1)
                if chunk:
                    chunks.append(chunk)
                    if chunk == b"\n":
                        break
        return b"".join(chunks)

    def _parse_frame(self, raw: bytes):
        if not raw:
            raise FlintecFrameError("No serial data received")

        match = None
        for match in self._continuous_re.finditer(raw):
            pass
        if match:
            status = match.group(1).decode("ascii", errors="replace")
            sign = match.group(2).decode("ascii")
            digits = match.group(3).decode("ascii")
            raw_count = int(digits) * (-1 if sign == "-" else 1)
            value = raw_count / (10 ** FLINTEC_DECIMALS)
            return {
                "value": round(value, 3),
                "displayValue": round(value, 1),
                "rawCount": raw_count,
                "rawFrame": raw.decode("ascii", errors="replace"),
                "stable": status.upper() == "S",
                "status": status,
                "tared": None,
                "format": "continuous",
            }

        bsi = None
        for bsi in self._bsi_weight_re.finditer(raw):
            pass
        if bsi:
            status = bsi.group(2).decode("ascii", errors="replace")
            sign = bsi.group(3).decode("ascii")
            value = float(bsi.group(4).decode("ascii"))
            if sign == "-":
                value = -value
            return {
                "value": round(value, 3),
                "displayValue": round(value, 1),
                "rawCount": None,
                "rawFrame": raw.decode("ascii", errors="replace"),
                "stable": status.upper() == "S",
                "status": status,
                "tared": None,
                "format": "bsi",
            }

        visible = raw.decode("ascii", errors="replace").replace("\r", "<CR>").replace("\n", "<LF>")
        raise FlintecFrameError(f"Unrecognized Flintec frame: {visible[:160]}")

    def read_weight(self):
        try:
            raw = self._read_bytes()
            parsed = self._parse_frame(raw)
            state["serial"]["lastFrame"] = parsed["rawFrame"]
            state["serial"]["lastParsedAt"] = now_iso()
            state["serial"]["lastError"] = None
            state["stable"] = bool(parsed["stable"])
            write_json(STATE_FILE, state)
            return {
                "value": parsed["displayValue"],
                "rawValue": parsed["value"],
                "rawCount": parsed["rawCount"],
                "unit": FLINTEC_UNIT,
                "stable": parsed["stable"],
                "tared": state["serial"].get("tareActive"),
                "source": "flintec-ft111-serial",
                "format": parsed["format"],
                "status": parsed["status"],
                "port": self._port_name,
                "decimals": FLINTEC_DECIMALS,
                "time": now_iso(),
            }
        except Exception as exc:
            state["serial"]["lastError"] = str(exc)
            write_json(STATE_FILE, state)
            self.close()
            raise

    def send_command(self, command: str):
        if not command:
            raise RuntimeError("Empty serial command")
        ser = self._open()
        payload = (command + FLINTEC_COMMAND_SUFFIX).encode("ascii")
        ser.write(payload)
        ser.flush()
        state["serial"]["lastCommand"] = command
        state["serial"]["lastCommandAt"] = now_iso()
        time.sleep(0.25)
        response = self._read_bytes(duration=0.75)
        state["serial"]["lastFrame"] = response.decode("ascii", errors="replace") if response else state["serial"]["lastFrame"]
        state["serial"]["lastError"] = None
        write_json(STATE_FILE, state)
        return {
            "ok": True,
            "command": command,
            "bytesWritten": len(payload),
            "response": response.decode("ascii", errors="replace") if response else "",
        }


flintec = FlintecSerialClient()


def real_read_weight():
    return flintec.read_weight()


def real_send_tare():
    result = flintec.send_command(FLINTEC_TARE_COMMAND)
    state["serial"]["tareActive"] = True
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Tare envoyée au FT-111", "serial": result, "weight": safe_real_weight()}


def real_remove_tare():
    result = flintec.send_command(FLINTEC_CLEAR_COMMAND)
    state["serial"]["tareActive"] = False
    write_json(STATE_FILE, state)
    return {"ok": True, "message": "Clear tare envoyé au FT-111", "serial": result, "weight": safe_real_weight()}


def real_send_serial_command(command):
    return flintec.send_command(command)


def safe_real_weight():
    try:
        return real_read_weight()
    except Exception as exc:
        return {"error": str(exc), "source": "flintec-ft111-serial", "time": now_iso()}


# =============================================================================
# Simulation / real dispatch
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
# HTTP server
# =============================================================================

class RpiSerialHandler(BaseHTTPRequestHandler):
    server_version = "FarineRpiSerialServer/0.2"

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
                "simulation": SIMULATION,
                "time": now_iso(),
            })
            return

        if path == "/api/status":
            with lock:
                send_json(self, 200, {
                    "ok": True,
                    "simulation": SIMULATION,
                    "config": {
                        "host": HOST,
                        "port": PORT,
                        "flintecPort": FLINTEC_PORT or "auto",
                        "flintecBaudrate": FLINTEC_BAUDRATE,
                        "flintecParity": FLINTEC_PARITY,
                        "flintecDecimals": FLINTEC_DECIMALS,
                        "flintecUnit": FLINTEC_UNIT,
                    },
                    "serial": state["serial"],
                    "simulationState": state["simulation"],
                    "weight": {
                        "grossWeight": round(float(state["grossWeight"]), 1),
                        "tareOffset": round(float(state["tareOffset"]), 1),
                        "stable": state["stable"],
                    },
                })
            return

        if path == "/api/ports":
            with lock:
                try:
                    ports = [
                        {"device": p.device, "description": p.description, "hwid": p.hwid}
                        for p in flintec.list_ports()
                    ]
                    send_json(self, 200, {"ok": True, "ports": ports})
                except Exception as exc:
                    send_json(self, 503, {"ok": False, "error": str(exc), "ports": []})
            return

        if path == "/api/weight":
            with lock:
                try:
                    send_json(self, 200, read_weight())
                except Exception as exc:
                    send_json(self, 503, {"error": str(exc), "source": "rpi-serial-server", "time": now_iso()})
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
                        try:
                            payload = read_weight()
                        except Exception as exc:
                            payload = {"error": str(exc), "time": now_iso()}
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
            try:
                if path == "/api/tare":
                    send_json(self, 200, send_tare())
                    return

                if path == "/api/tare/reset":
                    send_json(self, 200, remove_tare())
                    return

                if path == "/api/zero":
                    send_json(self, 200, send_serial_command(FLINTEC_ZERO_COMMAND))
                    return

                if path == "/api/serial/command":
                    command = str(body.get("command", "")).strip()
                    if not command:
                        send_json(self, 400, {"error": "command is required"})
                        return
                    send_json(self, 200, send_serial_command(command))
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
                    send_json(self, 200, {"ok": True, "weight": read_weight()})
                    return
            except Exception as exc:
                send_json(self, 503, {"ok": False, "error": str(exc), "time": now_iso()})
                return

        send_json(self, 404, {"error": "Not found"})


if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), RpiSerialHandler)
    print(f"RPi serial server listening on http://{HOST}:{PORT}")
    print("Role: expose Flintec weight and send tare/clear commands.")
    print(f"Mode: {'SIMULATION' if SIMULATION else 'REAL FT-111 SERIAL'}")
    if not SIMULATION:
        print(f"Serial: port={FLINTEC_PORT or 'auto'} baud={FLINTEC_BAUDRATE} parity={FLINTEC_PARITY} decimals={FLINTEC_DECIMALS}")
    server.serve_forever()
