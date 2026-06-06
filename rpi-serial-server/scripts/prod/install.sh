#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

SERVICE_NAME="${SERVICE_NAME:-farine-rpi-serial-server}"
INSTALL_DIR="${INSTALL_DIR:-/opt/farineapp/rpi-serial-server}"
ENV_FILE="${ENV_FILE:-/etc/${SERVICE_NAME}.env}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-$(id -un)}}"
SERVICE_GROUP="${SERVICE_GROUP:-$(id -gn "$SERVICE_USER")}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root:"
  echo "  sudo sh ./rpi-serial-server/scripts/prod/install.sh"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required"
  exit 1
fi

if ! python3 -m venv --help >/dev/null 2>&1; then
  echo "python3 venv support is required. On Raspberry Pi OS:"
  echo "  sudo apt install python3-venv"
  exit 1
fi

echo "Installing ${SERVICE_NAME} into ${INSTALL_DIR}..."
systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true

install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$INSTALL_DIR"
install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$INSTALL_DIR/scripts/prod"
install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$INSTALL_DIR/data"

install -m 0644 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$ROOT_DIR/server.py" "$INSTALL_DIR/server.py"
install -m 0644 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$ROOT_DIR/requirements.txt" "$INSTALL_DIR/requirements.txt"
install -m 0644 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$ROOT_DIR/README.md" "$INSTALL_DIR/README.md"
install -m 0755 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$ROOT_DIR/scripts/prod/start.sh" "$INSTALL_DIR/scripts/prod/start.sh"

echo "Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/python" -m pip install --upgrade pip
"$INSTALL_DIR/.venv/bin/python" -m pip install -r "$INSTALL_DIR/requirements.txt"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating ${ENV_FILE}..."
  cat > "$ENV_FILE" <<EOF
RPI_SERIAL_HOST=0.0.0.0
RPI_SERIAL_PORT=7001
RPI_SIMULATION=0
FLINTEC_PORT=
FLINTEC_BAUDRATE=9600
FLINTEC_PARITY=N
FLINTEC_BYTESIZE=8
FLINTEC_STOPBITS=1
FLINTEC_TIMEOUT=1.2
FLINTEC_DECIMALS=0
FLINTEC_UNIT=kg
FLINTEC_TARE_COMMAND=T
FLINTEC_CLEAR_COMMAND=C
FLINTEC_ZERO_COMMAND=Z
FLINTEC_COMMAND_SUFFIX=
EOF
fi

chmod 0644 "$ENV_FILE"

DIALOUT_LINE=""
if getent group dialout >/dev/null 2>&1; then
  usermod -a -G dialout "$SERVICE_USER" || true
  DIALOUT_LINE="SupplementaryGroups=dialout"
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=FarineAPP RPi Flintec serial server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
${DIALOUT_LINE}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/.venv/bin/python -u ${INSTALL_DIR}/server.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "Installed and started."
echo "Status:"
echo "  systemctl status ${SERVICE_NAME}"
echo "Logs:"
echo "  journalctl -u ${SERVICE_NAME} -f"
echo "API:"
echo "  curl http://127.0.0.1:7001/api/health"
