# Lumo-Band ESP32-C3 BLE peripheral

ESP-IDF 5.5.5 firmware for the ESP32-C3 SuperMini band. The C3 advertises as
`LUMO-TEST-C3` and sends a 12-byte test sample every two seconds after the S3
Hub subscribes.

## Build and flash

Open the `Lumo Band C3 ESP-IDF` terminal:

```powershell
idf.py set-target esp32c3
idf.py build
idf.py -p COMx flash monitor
```

## BLE contract

- Service: `12345678-1234-5678-1234-56789abcdef0`
- Characteristic: `12345678-1234-5678-1234-56789abcdef1`
- Properties: READ and NOTIFY
- Payload: `hr`, `steps`, `battery` as three little-endian `uint32_t` values
