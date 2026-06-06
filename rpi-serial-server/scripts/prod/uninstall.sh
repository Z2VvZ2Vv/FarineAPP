#!/usr/bin/env sh
set -eu

SERVICE_NAME="${SERVICE_NAME:-farine-rpi-serial-server}"
INSTALL_DIR="${INSTALL_DIR:-/opt/farineapp/rpi-serial-server}"
ENV_FILE="${ENV_FILE:-/etc/${SERVICE_NAME}.env}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root:"
  echo "  sudo sh ./rpi-serial-server/scripts/prod/uninstall.sh"
  exit 1
fi

systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
systemctl disable "$SERVICE_NAME" >/dev/null 2>&1 || true
rm -f "$SERVICE_FILE"
systemctl daemon-reload

echo "Service removed."
echo "Keeping data/config by default:"
echo "  ${INSTALL_DIR}"
echo "  ${ENV_FILE}"
echo ""
echo "To remove everything:"
echo "  sudo rm -rf ${INSTALL_DIR} ${ENV_FILE}"
