# RPi serial server

This service is for the Raspberry Pi.

Its only responsibilities are:

- stream/read the Flintec weight;
- send tare commands to the Flintec through USB serial;
- expose a small HTTP API over Ethernet.

It does not manage motors, rations, sessions, logs, or Shelly devices.

In development it can simulate the weight. In production it reads the FT-111 over USB serial.

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
sudo sh ./rpi-serial-server/scripts/prod/install.sh
```

Default URL:

```text
http://localhost:7001
```

After install:

```sh
systemctl status farine-rpi-serial-server
journalctl -u farine-rpi-serial-server -f
curl http://127.0.0.1:7001/api/weight
```

The installer copies the service to:

```text
/opt/farineapp/rpi-serial-server
```

Runtime config lives in:

```text
/etc/farine-rpi-serial-server.env
```

Manual foreground start, useful for debugging:

```sh
sh ./rpi-serial-server/scripts/prod/start.sh
```

## API

- `GET /api/health`
- `GET /api/status`
- `GET /api/ports`
- `GET /api/weight`
- `GET /api/weight/stream`
- `POST /api/tare`
- `POST /api/tare/reset`
- `POST /api/zero`
- `POST /api/serial/command`

Simulation-only endpoints:

- `POST /api/simulation/fill/start`
- `POST /api/simulation/fill/stop`
- `POST /api/simulation/reset`

## Real FT-111 mode

The production script starts with `RPI_SIMULATION=0` by default.

Useful environment variables:

```sh
export FLINTEC_PORT=/dev/ttyUSB0   # optional, otherwise auto-detected
export FLINTEC_BAUDRATE=9600
export FLINTEC_PARITY=N
export FLINTEC_DECIMALS=0
```

The USB frame observed during bench tests is:

```text
<STX>S+00000009<NUL><CR><LF>  # 9 kg on the tested FT-111
```

The value sent to Windows is net weight as reported by the FT-111 after its own tare.
`rawValue` keeps the parsed value with decimals; `value` is rounded for display.
