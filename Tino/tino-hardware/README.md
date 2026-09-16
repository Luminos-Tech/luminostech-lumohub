# ---- Tino Hardware (ESP-IDF) ----

Firmware for the **Tino** hardware node, built on **Espressif's ESP-IDF**.

> NOTE: This README will be filled in after the product description in
> `../docs/` is finalized. The skeleton below only documents the **bootstrap**
> so `idf.py` recognises the project and can build a minimal app.


## Requirements

- ESP-IDF v5.x installed and exported
  - Windows: `export.bat` from your ESP-IDF installation
  - Linux/macOS: `. $IDF_PATH/export.sh`
- A supported ESP32 target (default `esp32`; change via `idf.py set-target`)
- USB driver for your dev board (CP210x / CH343 …)


## Build & flash

From this directory, with the ESP-IDF environment active:

```bash
idf.py set-target esp32         # first time only
idf.py menuconfig               # optional: tweak settings
idf.py build
idf.py -p COM3 flash monitor    # adjust COM port to match your board
```


## Layout (planned)

```
tino-hardware/
├── CMakeLists.txt          # project-level build entry
├── sdkconfig.defaults      # project defaults (Kconfig)
├── main/
│   ├── CMakeLists.txt
│   ├── main.c              # app_main()
│   └── ...                 # (drivers / tasks added later)
├── components/             # reusable driver modules (added later)
├── docs/                   # pinouts, wiring notes (added later)
└── README.md               # ← to be expanded once docs/ is ready
```


## Talking to the backend

Once the backend contract is defined in `../docs/`, this section will describe:
- which API endpoints the device calls
- Wi-Fi provisioning / MQTT vs HTTPS
- secure-element / token storage strategy

