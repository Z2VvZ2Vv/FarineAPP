$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$serverScript = Join-Path $root "scripts\dev\start-server.ps1"
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$serverScript`""
Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:8080/"
