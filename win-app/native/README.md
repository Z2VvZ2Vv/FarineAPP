# FarineAPP native Windows

This folder contains the native Windows side:

- `FarineApp.ServerTray`: WinForms tray icon host.
- `FarineApp.WinUI`: WinUI 3 C# operator app.

## Prerequisites

This machine currently needs the .NET SDK, not only the runtime.

Install prerequisites:

```powershell
.\win-app\scripts\install-native-prereqs.ps1
```

Or manually install:

- .NET 8 SDK
- Windows App SDK runtime 2.0
- Visual Studio 2022 or Build Tools with:
  - `.NET desktop build tools`
  - `Universal Windows Platform build tools`
  - `Windows App SDK` component

The .NET SDK alone is not enough for WinUI 3. The build also needs PRI/MSIX build tasks normally provided by Visual Studio Build Tools.

## Development launch

Build:

```powershell
.\win-app\scripts\dev\build-native.ps1
```

WinUI 3 must be built with Visual Studio Build Tools `MSBuild.exe`, not plain `dotnet build`, because the Windows App SDK build uses Visual Studio Appx/PRI tasks.

Start tray host:

```powershell
.\win-app\scripts\dev\start-tray.ps1
```

The tray host starts and monitors:

- `rpi-serial-server/server.py`
- `win-app/server/server.py`

Then right-click the tray icon and choose `Ouvrir app native`.

Direct app launch, if the server is already running:

```powershell
.\win-app\scripts\dev\start-native-app.ps1
```

## Production direction

The production startup target should be the tray host.
It gives a visible server status from the Windows notification area and can start/stop both local services.
