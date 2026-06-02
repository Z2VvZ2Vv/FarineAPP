#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

export RPI_SERIAL_HOST="${RPI_SERIAL_HOST:-0.0.0.0}"
export RPI_SERIAL_PORT="${RPI_SERIAL_PORT:-7001}"

cd "$ROOT_DIR"
exec python3 server.py
