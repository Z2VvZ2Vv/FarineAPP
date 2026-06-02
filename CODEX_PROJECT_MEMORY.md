# FarineAPP - project memory for Codex

## Correct target structure

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

### Raspberry Pi: `rpi-serial-server`

The Raspberry Pi is only a Flintec / serial bridge.

It must:

- expose a web server;
- stream or return the current weight;
- send tare commands to the Flintec through USB serial;
- keep a simulation mode until real serial integration is implemented.

It must not:

- manage motors;
- know recipes;
- own logs;
- own sessions;
- call Shelly devices.

### Windows tablet: `win-app`

The Windows tablet is the main system.

It must:

- run the main server in `win-app/server`;
- serve the app from `win-app/app`;
- own recipes, sessions, logs, and global status;
- call the RPi serial server for weight and tare;
- control motors through Shelly Pro 2 over WiFi;
- provide scripts in `win-app/scripts`.

## Current implementation

- Both servers are written with Python standard library only.
- No npm dependency is required.
- `rpi-serial-server/server.py` simulates Flintec weight/tare.
- `win-app/server/server.py` serves the app, handles recipes/sessions/logs, polls RPi weight, and controls Shelly motors.
- Shelly control is simulated by default in `win-app/server/config.json`.
- Root dev start is `start-dev.ps1`.
- RPi prod scripts are shell scripts in `rpi-serial-server/scripts/prod`.
- Native C# projects live in `win-app/native`.
- `FarineApp.ServerTray` is the Windows tray host that starts/monitors local servers.
- `FarineApp.WinUI` is the native WinUI 3 operator app.

## Later work

1. Replace RPi simulation with real USB serial Flintec code.
2. Configure real Shelly Pro 2 URL and relay mapping.
3. Improve persistence, likely SQLite, once the workflow stabilizes.
4. Package Windows server/app for production startup.
5. Optionally replace the web tablet UI with a WinUI 3 native shell after the flow is fixed.
