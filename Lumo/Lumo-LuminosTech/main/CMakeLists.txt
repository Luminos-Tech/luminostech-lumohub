# =============================================================
# Lumo Hub build — chọn main theo MODE hiện tại
# =============================================================
#
# Đổi MODE ngay tại đây rồi build lại, KHÔNG cần menuconfig:
#
#   MODE = full        → build full runtime (Lumo-LuminosTech.c + lumo_runtime.c + ...)
#   MODE = button_test → build chỉ button test, tắt hết WiFi/BLE/mic/OLED/audio
#
# Sau khi build, muốn đổi qua lại: sửa 1 dòng dưới rồi chạy `idf.py build`.
# =============================================================

set(MODE "full" CACHE STRING "Build mode: full | button_test")

if(MODE STREQUAL "button_test")
    # === CHẾ ĐỘ TEST BUTTON ===
    # Chỉ test nút nhấn, không có WiFi/BLE/mic/OLED/audio.
    idf_component_register(
        SRCS
            "button_test_main.c"
            "button/button.c"
        INCLUDE_DIRS
            "."
            "button"
        REQUIRES
            esp_driver_gpio
            esp_timer
            freertos
    )

elseif(MODE STREQUAL "full")
    # === FULL RUNTIME (production) ===
    # OLED DISABLED — OLED module không được gắn trên hardware, không build
    # để tránh khởi tạo I2C bus và gây crash. Để bật lại: thêm dòng
    #     "oled/oled.c" vào SRCS và "oled" + "oled/font5x7" vào INCLUDE_DIRS.
    idf_component_register(
        SRCS
            "Lumo-LuminosTech.c"
            "lumo_runtime.c"
            "ble/lumo_band_central.c"
            "audio/audio_player.c"
            "button/button.c"
            "wifi/web_portal.c"
            "wifi/wifi_manager.c"
            "http_api/http_api.c"
            "mic/mic.c"
            "record/record.c"
        INCLUDE_DIRS
            "."
            "audio"
            "button"
            "ble"
            "wifi"
        REQUIRES
            esp_driver_i2s
            esp_driver_gpio
            esp_timer
            esp_http_server
            nvs_flash
            esp_wifi
            spi_flash
            esp_http_client
            mbedtls
            spiffs
            bt
    )

else()
    message(FATAL_ERROR "Unknown MODE='${MODE}'. Use 'full' or 'button_test'.")
endif()
