$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$repo = Split-Path -Parent $root
$logDir = Join-Path $repo "logs\dev"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Set-Content -Path (Join-Path $logDir "win-launch.log") -Value "Starting Windows dev server from $root at $(Get-Date -Format o)"
$env:WIN_APP_HOST = "127.0.0.1"
$env:WIN_APP_PORT = "8080"
try {
  python (Join-Path $root "server\server.py") *>> (Join-Path $logDir "win-python.log")
} catch {
  Add-Content -Path (Join-Path $logDir "win-launch.log") -Value $_.Exception.Message
  throw
}
