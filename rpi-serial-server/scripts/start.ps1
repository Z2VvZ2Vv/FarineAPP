$ErrorActionPreference = "Stop"
$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "dev\start.ps1"
& $script
