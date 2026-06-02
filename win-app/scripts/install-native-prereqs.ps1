$ErrorActionPreference = "Stop"

Write-Host "Installing native Windows prerequisites for FarineAPP..."
Write-Host "This needs internet access and may require admin rights."
Write-Host ""

# .NET 10 SDK is fine if already installed. Keep .NET 8 SDK optional because the project targets net8.0-windows.
winget install --id Microsoft.DotNet.SDK.10 --source winget
winget install --id Microsoft.WindowsAppRuntime.2.0 --source winget
winget install --id Microsoft.VisualStudio.2022.BuildTools --source winget --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.ManagedDesktopBuildTools --add Microsoft.VisualStudio.Workload.UniversalBuildTools --add Microsoft.VisualStudio.Component.WindowsAppSDK"

Write-Host ""
Write-Host "Then install the WinUI project dependencies/build with:"
Write-Host "  .\win-app\scripts\dev\build-native.ps1"
