@echo off
for %%P in (COM3 COM4 COM5 COM6) do (
    echo === %%P ===
    "C:\Espressif\python_env\idf5.5_py3.11_env\Scripts\python.exe" "C:\Espressif\frameworks\esp-idf-v5.5.5\components\esptool_py\esptool\esptool.py" --port %%P chip_id 2>&1
    echo.
)
