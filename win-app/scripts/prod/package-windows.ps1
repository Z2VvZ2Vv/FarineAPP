$ErrorActionPreference = "Stop"

$winRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$repoRoot = Split-Path -Parent $winRoot
$releaseRoot = Join-Path $winRoot "releases\FarineAPP"
$nativeRoot = Join-Path $winRoot "native"
$solution = Join-Path $nativeRoot "FarineApp.Native.sln"

. (Join-Path $winRoot "scripts\dev\msbuild-path.ps1")
$msbuild = Get-FarineMsBuildPath

Write-Host "Building native Windows apps in Release..."
& $msbuild $solution /t:Restore,Build /p:Configuration=Release /p:Platform=x64 /v:minimal

$resolvedRepo = [System.IO.Path]::GetFullPath($repoRoot)
$resolvedRelease = [System.IO.Path]::GetFullPath($releaseRoot)
if (-not $resolvedRelease.StartsWith($resolvedRepo, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Release path is outside the repository: $resolvedRelease"
}

if (Test-Path $releaseRoot) {
  Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot "native") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $releaseRoot "logs") | Out-Null

function Copy-Dir {
  param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination
  )
  if (-not (Test-Path $Source)) {
    throw "Missing source: $Source"
  }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
}

function Copy-File {
  param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination
  )
  if (-not (Test-Path $Source)) {
    throw "Missing source: $Source"
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

$trayBuild = Join-Path $nativeRoot "FarineApp.ServerTray\bin\x64\Release\net8.0-windows"
$winUiBuild = Join-Path $nativeRoot "FarineApp.WinUI\bin\x64\Release\net8.0-windows10.0.19041.0"

Copy-Dir $trayBuild (Join-Path $releaseRoot "native\FarineApp.ServerTray")
Copy-Dir $winUiBuild (Join-Path $releaseRoot "native\FarineApp.WinUI")

Copy-File (Join-Path $repoRoot "rpi-serial-server\server.py") (Join-Path $releaseRoot "rpi-serial-server\server.py")
Copy-Dir (Join-Path $winRoot "app") (Join-Path $releaseRoot "win-app\app")
Copy-File (Join-Path $winRoot "server\server.py") (Join-Path $releaseRoot "win-app\server\server.py")
Copy-File (Join-Path $winRoot "server\config.json") (Join-Path $releaseRoot "win-app\server\config.json")
Copy-Dir (Join-Path $winRoot "server\data\rations") (Join-Path $releaseRoot "win-app\server\data\rations")
New-Item -ItemType Directory -Path (Join-Path $releaseRoot "win-app\server\data") -Force | Out-Null

$startScript = @'
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tray = Join-Path $root "native\FarineApp.ServerTray\FarineApp.ServerTray.exe"
if (-not (Test-Path $tray)) {
  throw "FarineApp.ServerTray.exe introuvable. Rebuild la release."
}
Set-Location $root
Start-Process -FilePath $tray -WorkingDirectory $root
Write-Host "FarineAPP lance. Regarde l'icone dans la barre des taches."
Write-Host "Admin web: http://127.0.0.1:8080/"
'@

$openWebScript = @'
$ErrorActionPreference = "Stop"
Start-Process "http://127.0.0.1:8080/"
'@

$stopScript = @'
$ErrorActionPreference = "Stop"
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path).ToLowerInvariant()

Get-Process FarineApp.ServerTray, FarineApp.WinUI -ErrorAction SilentlyContinue | Stop-Process -Force

Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine.ToLowerInvariant().Contains($root) -and
    ($_.CommandLine.Contains("server.py") -or $_.Name -match "python")
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Write-Host "FarineAPP stoppe pour cette release."
'@

$installScript = @'
$ErrorActionPreference = "Stop"
Write-Host "Installation des prerequis FarineAPP..."
Write-Host "Si winget demande confirmation, accepte les conditions."
winget install --id Python.Python.3.12 --source winget
winget install --id Microsoft.DotNet.DesktopRuntime.8 --source winget
winget install --id Microsoft.WindowsAppRuntime.2.0 --source winget
Write-Host ""
Write-Host "Prerequis termines. Lance ensuite Start-FarineAPP.ps1"
'@

$readme = @'
FarineAPP - Release Windows tablette
===================================

1. Premiere fois sur la tablette:
   clic droit sur Install-Prereqs.ps1 -> Executer avec PowerShell

2. Lancer FarineAPP:
   clic droit sur Start-FarineAPP.ps1 -> Executer avec PowerShell

3. Quand l'icone apparait dans la barre des taches:
   - Ouvrir app native
   - Ouvrir admin web
   - Statut
   - Arreter les serveurs / Quitter

Admin web:
   http://127.0.0.1:8080/

Notes:
   - Le RPi est simule dans cette release.
   - Le poids est simule.
   - Les logs sont dans .\logs\native
   - Les rations sont dans .\win-app\server\data\rations
'@

Set-Content -Path (Join-Path $releaseRoot "Start-FarineAPP.ps1") -Value $startScript -Encoding UTF8
Set-Content -Path (Join-Path $releaseRoot "Open-Web-App.ps1") -Value $openWebScript -Encoding UTF8
Set-Content -Path (Join-Path $releaseRoot "Stop-FarineAPP.ps1") -Value $stopScript -Encoding UTF8
Set-Content -Path (Join-Path $releaseRoot "Install-Prereqs.ps1") -Value $installScript -Encoding UTF8
Set-Content -Path (Join-Path $releaseRoot "README_RELEASE.txt") -Value $readme -Encoding UTF8

$required = @(
  "native\FarineApp.ServerTray\FarineApp.ServerTray.exe",
  "native\FarineApp.WinUI\FarineApp.WinUI.exe",
  "rpi-serial-server\server.py",
  "win-app\server\server.py",
  "win-app\app\index.html",
  "Start-FarineAPP.ps1",
  "Install-Prereqs.ps1"
)

foreach ($relative in $required) {
  $path = Join-Path $releaseRoot $relative
  if (-not (Test-Path $path)) {
    throw "Release incomplete, missing: $relative"
  }
}

Write-Host ""
Write-Host "Windows release ready:"
Write-Host "  $releaseRoot"
Write-Host ""
Write-Host "Launch with:"
Write-Host "  .\win-app\releases\FarineAPP\Start-FarineAPP.ps1"
