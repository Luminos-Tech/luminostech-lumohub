# Lumo-Band ESP32-C3 SuperMini

Zephyr firmware for the Lumo-Band on ESP32-C3 SuperMini. The band advertises
as a BLE peripheral for a phone or companion hub. Wi-Fi is available on the
chip but is not enabled because the current Lumo-Band application does not use
it.

## BLE contract

- Device name: `LUMO-BAND`
- Service: `7c5a0001-5d5a-4f7b-8c3a-6a6d2e8f1001`
- TX notify: `7c5a0002-5d5a-4f7b-8c3a-6a6d2e8f1001`
- RX write/write-without-response: `7c5a0003-5d5a-4f7b-8c3a-6a6d2e8f1001`

The UUIDs and GATT behavior are unchanged from the nRF52840 prototype. The
current permissions are for bench testing; pairing, bonding and encrypted
characteristics are still required before handling real user or safety data.

## Setup

From the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Lumo\setup-zephyr.ps1
```

Restart the terminal after first-time setup.

## Build

Recommended target for the physical SuperMini:

```powershell
Set-Location .\Lumo\Lumo-Band
west build -p always -b esp32c3_supermini -d build
```

Compatibility target required by the migration checklist:

```powershell
west build -p always -b esp32c3_devkitm -d build
```

Both targets use the signal overlays in `boards/`. See
`MIGRATION_ESP32C3.md` before connecting sensors.

## Flash over USB Type-C

Connect the ESP32-C3 and run:

```powershell
west flash -d build
```

If automatic port detection selects the wrong serial device:

```powershell
west flash -d build --esp-device COMx
```

No UF2 bootloader or SWD/J-Link probe is required. If the board does not enter
download mode automatically, hold BOOT, tap RESET, release BOOT, then retry.

The default runner is Zephyr's `esp32` runner, which invokes Espressif
`esptool.py` from `hal_espressif`.
