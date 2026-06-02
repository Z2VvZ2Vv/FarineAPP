$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$solution = Join-Path $root "native\FarineApp.Native.sln"
$msbuild = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
if (-not (Test-Path $msbuild)) {
  throw "MSBuild.exe introuvable. Installe Visual Studio Build Tools."
}
& $msbuild $solution /t:Restore,Build /p:Configuration=Release /p:Platform=x64 /v:minimal
