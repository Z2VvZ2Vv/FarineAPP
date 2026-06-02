# RPi serial server

This service is for the Raspberry Pi.

Its only responsibilities are:

- stream/read the Flintec weight;
- send tare commands to the Flintec through USB serial;
- expose a small HTTP API over Ethernet.

It does not manage motors, rations, sessions, logs, or Shelly devices.

For now, weight and serial commands are simulated. The real USB serial code will be added later.

## Start

```powershell
.\rpi-serial-server\scripts\dev\start.ps1
```

or:

```powershell
python .\rpi-serial-server\server.py
```

Production on the Raspberry Pi:

```sh
sh ./rpi-serial-server/scripts/prod/start.sh
```

Default URL:

```text
http://localhost:7001
```

## API

- `GET /api/health`
- `GET /api/status`
- `GET /api/weight`
- `GET /api/weight/stream`
- `POST /api/tare`
- `POST /api/serial/command`

Simulation-only endpoints:

- `POST /api/simulation/fill/start`
- `POST /api/simulation/fill/stop`
- `POST /api/simulation/reset`
