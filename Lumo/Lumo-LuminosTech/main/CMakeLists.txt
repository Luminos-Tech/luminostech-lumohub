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

set(MODE "full" CACHE STRING "Build mode: full | button_test | debug_wifi_only | audio_test")

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

elseif(MODE STREQUAL "debug_wifi_only")
    # === CHE DO DEBUG WiFi-ONLY ===
    idf_component_register(
        SRCS
            "debug_wifi_only.c"
            "wifi/web_portal.c"
            "wifi/wifi_manager.c"
        INCLUDE_DIRS
            "."
            "wifi"
        REQUIRES
            esp_wifi
            esp_http_server
            nvs_flash
            esp_netif
            esp_app_format
    )

elseif(MODE STREQUAL "audio_test")
    # === CHE DO TEST LOA (PHAT LIEN TUC) ===
    # Chi SPIFFS + audio_play() de test loa va do thoi luong pin.
    # Tat TAT CA: BLE, MIC, BUTTON, WiFi, HTTP, voice assistant.
    idf_component_register(
        SRCS
            "audio_test_main.c"
            "audio/audio_player.c"
        INCLUDE_DIRS
            "."
            "audio"
        REQUIRES
            esp_driver_i2s
            esp_timer
            nvs_flash
            esp_app_format
            spi_flash
            spiffs
    )

elseif(MODE STREQUAL "full")
    # === FULL RUNTIME (production) ===
    # OLED đã TẮT trong build này (v0.5.1-test-no-oled) — phần cứng không có OLED
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
            esp_app_format  # esp_app_desc.h - dung de in firmware version
            esp_wifi
            spi_flash
            esp_http_client
            mbedtls
            spiffs
            bt
    )

else()
    message(FATAL_ERROR "Unknown MODE='${MODE}'. Use 'full', 'button_test', 'debug_wifi_only', or 'audio_test'.")
endif()
