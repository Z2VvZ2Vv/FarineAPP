$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$solution = Join-Path $root "native\FarineApp.Native.sln"
. (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "msbuild-path.ps1")
$msbuild = Get-FarineMsBuildPath
& $msbuild $solution /t:Restore,Build /p:Configuration=Debug /p:Platform=x64 /v:minimal
