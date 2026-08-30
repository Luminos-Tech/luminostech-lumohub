# nRF52840 to ESP32-C3 migration audit

## Previous nRF dependencies

The source files under `src/` and `include/` did not use Nordic drivers,
SoftDevice, nrfx, or nRF-specific Zephyr APIs. BLE already used Zephyr's
portable host/GATT API, so the service UUIDs and characteristic behavior did
not need to change.

The nRF-specific surface was limited to:

- `boards/arm/nrf52840_supermini/`: nRF52840 SoC selection, Nordic DTS,
  `NRF_PSEL` UART pins, Nordic UARTE/USBD nodes, nrfjprog and UF2 runners.
- `prj.conf`: UF2 output and code-partition options.
- `README.md`: nRF52840, UF2, SWD, J-Link and nrfjprog instructions.
- `setup-zephyr.ps1`: Nordic HAL modules and ARM Zephyr SDK toolchain.

The old board directory remains in the repository for reference, but it is no
longer a supported/default Lumo-Band build target.

## ESP32-C3 hardware map

| Signal | ESP32-C3 SuperMini pin | Status |
| --- | --- | --- |
| Status LED | GPIO8, active low | Upstream board mapping |
| BOOT/user button | GPIO9, active low | Upstream board mapping |
| I2C SDA | GPIO5 | Reserved; sensor node TODO |
| I2C SCL | GPIO6 | Reserved; sensor node TODO |
| SPI MISO | GPIO0 | Reserved; sensor node TODO |
| SPI MOSI | GPIO3 | Reserved; sensor node TODO |
| SPI SCLK | GPIO4 | Reserved; sensor node TODO |
| SPI CS | GPIO7 | Reserved; sensor node TODO |
| Console/flash | Native USB Serial/JTAG | No UF2/SWD required |

No sensor, activity-processing, fall-detection, or power-management module was
present in the original Lumo-Band source. Those cannot be migrated until the
exact sensor parts, addresses, interrupt pins and power circuit are defined.

## Kconfig notes

`CONFIG_SOC_ESP32C3` and `CONFIG_BT_ESP32` are hidden Zephyr symbols selected
by the board and enabled `esp32_bt_hci` devicetree node. `CONFIG_ESP32C3` and
`CONFIG_BT_BLE` do not exist in Zephyr 4.2.0. Assigning these manually would
make Kconfig fail, so `prj.conf` keeps the portable `CONFIG_BT` and
`CONFIG_BT_PERIPHERAL` settings while the board selects the ESP32-C3 layer.
