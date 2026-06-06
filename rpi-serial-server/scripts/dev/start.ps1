$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$repo = Split-Path -Parent $root
$logDir = Join-Path $repo "logs\dev"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Set-Content -Path (Join-Path $logDir "rpi-launch.log") -Value "Starting RPi dev server from $root at $(Get-Date -Format o)"
$env:RPI_SERIAL_HOST = "127.0.0.1"
$env:RPI_SERIAL_PORT = "7001"
try {
  python (Join-Path $root "server.py") *>> (Join-Path $logDir "rpi-python.log")
} catch {
  Add-Content -Path (Join-Path $logDir "rpi-launch.log") -Value $_.Exception.Message
  throw
}
