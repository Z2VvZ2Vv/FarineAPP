$ErrorActionPreference = "Stop"
Write-Host "Installing rpi-serial-server Python dependencies..."
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
python -m pip install -r (Join-Path $root "requirements.txt")
Write-Host "Start with: .\rpi-serial-server\scripts\dev\start.ps1"
