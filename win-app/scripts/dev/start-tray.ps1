$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$solution = Join-Path $root "native\FarineApp.Native.sln"
$exe = Join-Path $root "native\FarineApp.ServerTray\bin\x64\Debug\net8.0-windows\FarineApp.ServerTray.exe"
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "msbuild-path.ps1")
$msbuild = Get-FarineMsBuildPath
& $msbuild $solution /t:Restore,Build /p:Configuration=Debug /p:Platform=x64 /v:minimal
Start-Process $exe
