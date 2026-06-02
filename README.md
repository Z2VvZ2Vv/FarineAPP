# FarineAPP

FarineAPP is now split into two production-oriented parts:

```text
farineapp/
  start-dev.ps1
  rpi-serial-server/
    scripts/
      dev/
      prod/
  win-app/
    app/
    server/
    scripts/
      dev/
      prod/
```

## Responsibilities

### `rpi-serial-server`

Runs on the Raspberry Pi.

It only handles the Flintec/serial side:

- read or stream the current weight;
- send tare commands;
- prepare for future USB serial communication.

It does not manage motors, rations, logs, or business logic.

### `win-app`

Runs on the Windows 11 industrial tablet.

It owns:

- the local web app in `win-app/app`;
- the main control server in `win-app/server`;
- the native Windows tray/server host in `win-app/native/FarineApp.ServerTray`;
- the native WinUI 3 operator app in `win-app/native/FarineApp.WinUI`;
- rations, sessions, logs, status;
- motor commands through Shelly Pro 2 over WiFi;
- calls to the RPi for weight and tare.

## Native Windows app

Install native prerequisites:

```powershell
.\win-app\scripts\install-native-prereqs.ps1
```

Build native projects:

```powershell
.\win-app\scripts\dev\build-native.ps1
```

Launch the server tray icon:

```powershell
.\win-app\scripts\dev\start-tray.ps1
```

Right-click the tray icon and choose `Ouvrir app native`.

## Start in development

Start both the simulated RPi server and the Windows server:

```powershell
.\start-dev.ps1
```

Then open:

```text
http://127.0.0.1:8080/
```

## Start separately

RPi serial server:

```powershell
.\rpi-serial-server\scripts\dev\start.ps1
```

Windows server:

```powershell
.\win-app\scripts\dev\start-server.ps1
```

## Production scripts

RPi production script is shell-based:

```sh
sh ./rpi-serial-server/scripts/prod/start.sh
```

Windows production server script:

```powershell
.\win-app\scripts\prod\start-server.ps1
```

## Current simulation

- RPi weight is simulated.
- RPi tare is simulated.
- Shelly Pro 2 motor control is simulated by default.
- When motors are switched on in simulation, the Windows server asks the RPi simulator to increase the weight.

Production config is in:

```text
win-app/server/config.json
```
