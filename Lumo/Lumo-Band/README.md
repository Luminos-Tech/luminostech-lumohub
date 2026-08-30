# Lumo-Band ESP32-C3 SuperMini (ESP-IDF)

Firmware for ESP32-C3 SuperMini built exclusively with ESP-IDF. Zephyr,
`west`, devicetree overlays, UF2, nrfjprog and Nordic SDK components are not
used by this project.

## Current smoke test

`src/main.c` prints a counter every second over the ESP32-C3 native USB
Serial/JTAG console. Expected output:

```text
I (...) lumo_band: ================================
I (...) lumo_band:  LUMO-BAND ESP32-C3 SUPERMINI
I (...) lumo_band:  ESP-IDF flash and console OK
I (...) lumo_band: Lumo-Band running: 0 second(s)
I (...) lumo_band: Lumo-Band running: 1 second(s)
```

## Build

Open an ESP-IDF 5.5 terminal, then run:

```powershell
Set-Location .\Lumo\Lumo-Band
idf.py set-target esp32c3
idf.py build
```

## Flash and monitor

```powershell
idf.py -p COMx flash monitor
```

Exit the monitor with `Ctrl+]`. If automatic reset does not enter download
mode, hold BOOT, tap RESET, release BOOT, then retry.

## BLE contract

`src/lumo_ble.c` uses the ESP-IDF NimBLE host and preserves the prototype GATT
contract:

- Device name: `LUMO-BAND`
- Service: `7c5a0001-5d5a-4f7b-8c3a-6a6d2e8f1001`
- TX notify: `7c5a0002-5d5a-4f7b-8c3a-6a6d2e8f1001`
- RX write/write-without-response: `7c5a0003-5d5a-4f7b-8c3a-6a6d2e8f1001`

The console smoke test intentionally does not call `lumo_ble_init()`. Enable
it from `app_main()` after flash/console verification.
