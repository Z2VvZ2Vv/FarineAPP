$ErrorActionPreference = "Stop"
$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "dev\install.ps1"
& $script
