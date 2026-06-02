$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$project = Join-Path $root "native\FarineApp.WinUI\FarineApp.WinUI.csproj"
$exe = Join-Path $root "native\FarineApp.WinUI\bin\x64\Debug\net8.0-windows10.0.19041.0\FarineApp.WinUI.exe"
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "msbuild-path.ps1")
$msbuild = Get-FarineMsBuildPath
& $msbuild $project /t:Restore,Build /p:Configuration=Debug /p:Platform=x64 /v:minimal
Start-Process $exe
