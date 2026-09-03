# ESP-IDF migration notes

Lumo-Band now targets ESP32-C3 directly with ESP-IDF 5.5.

Removed framework dependencies:

- Zephyr `west` build files and `prj.conf`
- Zephyr kernel, logging, Bluetooth and devicetree APIs
- nRF52840 board definitions, Nordic pinctrl and nrfjprog/UF2 runners
- Zephyr ESP32-C3 board overlays and Zephyr SDK setup script

ESP-IDF replacements:

- `app_main()` and FreeRTOS tasks/delays
- `ESP_LOGx` logging through native USB Serial/JTAG
- ESP-IDF NimBLE host with the existing Lumo GATT UUIDs
- ESP32-C3 ROM downloader and esptool through `idf.py flash`

The project did not contain sensor-reading, fall-detection or power-management
source before this migration. GPIO/I2C/SPI assignments should be added with
ESP-IDF drivers when the exact sensor PCB is known.
