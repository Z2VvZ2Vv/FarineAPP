param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root "logs\dev"
$rpiScript = Join-Path $root "rpi-serial-server\scripts\dev\start.ps1"
$winScript = Join-Path $root "win-app\scripts\dev\start-server.ps1"
$rpiOut = Join-Path $logDir "rpi.out.log"
$rpiErr = Join-Path $logDir "rpi.err.log"
$winOut = Join-Path $logDir "win.out.log"
$winErr = Join-Path $logDir "win.err.log"

function Stop-PortProcess {
  param([int]$Port)
  $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    $procId = [int]$parts[-1]
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [string]$Name,
    [string]$ErrorLog
  )

  for ($i = 0; $i -lt 20; $i++) {
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 1
      if ($response.ok -eq $true) {
        Write-Host "OK: $Name is ready at $Url"
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  Write-Host ""
  Write-Host "ERROR: $Name did not start." -ForegroundColor Red
  if (Test-Path $ErrorLog) {
    Write-Host "Last errors from ${ErrorLog}:" -ForegroundColor Yellow
    Get-Content $ErrorLog -Tail 30
  }
  throw "$Name failed to start"
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Remove-Item -LiteralPath $rpiOut, $rpiErr, $winOut, $winErr -Force -ErrorAction SilentlyContinue

Write-Host "Stopping any previous dev servers on ports 7001 and 8080..."
Stop-PortProcess -Port 7001
Stop-PortProcess -Port 8080

Write-Host "Starting FarineAPP dev stack..."
Write-Host "  RPi serial server: http://127.0.0.1:7001"
Write-Host "  Windows app/server: http://127.0.0.1:8080"
Write-Host "  Logs: $logDir"
Write-Host ""

Start-Process powershell `
  -WindowStyle Hidden `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$rpiScript`""

Wait-HttpOk -Url "http://127.0.0.1:7001/api/health" -Name "RPi serial server" -ErrorLog $rpiErr

Start-Process powershell `
  -WindowStyle Hidden `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$winScript`""

Wait-HttpOk -Url "http://127.0.0.1:8080/api/health" -Name "Windows app/server" -ErrorLog $winErr

Write-Host ""
Write-Host "FarineAPP dev stack is ready."
Write-Host "App URL: http://127.0.0.1:8080/"

if (-not $NoBrowser) {
  Start-Process "http://127.0.0.1:8080/"
}
