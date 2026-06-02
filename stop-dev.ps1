$ErrorActionPreference = "Stop"

function Stop-PortProcess {
  param([int]$Port)
  $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
    $procId = [int]$parts[-1]
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped process $procId on port $Port"
  }
}

Stop-PortProcess -Port 7001
Stop-PortProcess -Port 8080
Write-Host "FarineAPP dev stack stopped."
