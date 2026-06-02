$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$exe = Join-Path $root "native\FarineApp.ServerTray\bin\Release\net8.0-windows\win-x64\publish\FarineApp.ServerTray.exe"
if (-not (Test-Path $exe)) {
  throw "Tray executable not found. Build first with .\win-app\scripts\prod\build-native.ps1"
}
Start-Process $exe
