$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$env:WIN_APP_HOST = "0.0.0.0"
$env:WIN_APP_PORT = "8080"
python (Join-Path $root "server\server.py")
