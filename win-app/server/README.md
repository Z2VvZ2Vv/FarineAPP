# Windows server

This is the main FarineAPP control server for the Windows 11 tablet.

Responsibilities:

- own recipes, sessions, logs, and global status;
- serve the tablet app from `../app`;
- read/tare weight through `rpi-serial-server`;
- control motors through Shelly Pro 2 over WiFi;
- keep simulation mode available for development.

It does not talk to the Flintec directly. The Raspberry Pi owns USB serial communication.

## Start

From the repository root:

```powershell
.\win-app\scripts\dev\start-server.ps1
```

or:

```powershell
python .\win-app\server\server.py
```

Production server start:

```powershell
.\win-app\scripts\prod\start-server.ps1
```

Default URL:

```text
http://localhost:8080
```

## Shelly config

Edit `config.json`:

```json
{
  "shelly": {
    "simulation": false,
    "baseUrl": "http://192.168.33.1",
    "relayMap": {
      "corn": 0,
      "alfalfa": 1
    }
  }
}
```

In simulation mode, motor commands update local state and ask the RPi simulator to make the weight increase.
