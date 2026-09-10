/* ============================================================================
 * LUMO WiFi-Only Debug Firmware
 * ----------------------------------------------------------------------------
 * Mục đích: tách biệt chỉ còn WiFi + AP mode để xác định nguyên nhân
 *            "không thấy WiFi LUMO_SETUP" trên điện thoại.
 *
 * TẮT TẤT CẢ:
 *   - BLE central (lumo_band_central)
 *   - SPIFFS / list file
 *   - Microphone (I2S)
 *   - Audio (I2S playback)
 *   - Button (GPIO 42)
 *   - OLED (đã tắt sẵn)
 *   - Voice assistant / record / upload
 *   - Server events / HTTP
 *
 * CHỈ GIỮ:
 *   - NVS init (đọc WiFi saved)
 *   - WiFi try_connect_saved()
 *       → fail → wifi_start_config_portal()
 *       → AP LUMO_SETUP chạy VĨNH VIỄN, không tắt để STA reconnect
 *   - Log cực chi tiết để debug (SSID saved, pass len, lý do fail, trạng thái AP)
 *
 * Cách chạy:
 *   - Build với main/Lumo-LuminosTech-debug-wifi.c này
 *   - Flash, mở monitor, đọc log
 *   - Nếu thấy "AP LUMO_SETUP is UP forever" → thử điện thoại khác quét
 *   - Nếu điện thoại vẫn không thấy → vấn đề là radio/band/driver
 *
 * Restore: xóa file này + đổi CMakeLists.txt trỏ về Lumo-LuminosTech.c gốc
 * ============================================================================ */

#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_log.h"
#include "esp_err.h"
#include "esp_app_desc.h"
#include "esp_heap_caps.h"
#include "nvs_flash.h"

#include "wifi/wifi_manager.h"

static const char *TAG = "WIFI_DEBUG";

/* ============================================================================
 * LUMO DEBUG WiFi-Only Firmware Version
 * ============================================================================ */
#define LUMO_FW_VERSION_STRING  "DEBUG-WIFI-ONLY v0.1.0"
#define LUMO_FW_BUILD_DATE      __DATE__
#define LUMO_FW_BUILD_TIME      __TIME__

static void print_firmware_version(void)
{
    const esp_app_desc_t *app_desc = esp_app_get_description();

    ESP_LOGI(TAG, "=========================================================");
    ESP_LOGI(TAG, "  LUMO DEBUG WiFi-Only BUILD INFO");
    ESP_LOGI(TAG, "---------------------------------------------------------");
    ESP_LOGI(TAG, "  App name      : %s", app_desc->project_name);
    ESP_LOGI(TAG, "  App version   : %s", app_desc->version);
    ESP_LOGI(TAG, "  IDF version   : %s", app_desc->idf_ver);
    ESP_LOGI(TAG, "  Compile time  : %s %s", app_desc->date, app_desc->time);
    ESP_LOGI(TAG, "  ELF SHA256    : %s...", app_desc->app_elf_sha256);
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "  >>> LUMO FW VERSION: %s <<<", LUMO_FW_VERSION_STRING);
    ESP_LOGI(TAG, "  >>> BUILD DATE/TIME: %s %s <<<",
             LUMO_FW_BUILD_DATE, LUMO_FW_BUILD_TIME);
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "  ACTIVE FEATURES (this build):");
    ESP_LOGI(TAG, "    NVS       = ON");
    ESP_LOGI(TAG, "    WiFi STA  = ON");
    ESP_LOGI(TAG, "    WiFi AP   = ON (vĩnh viễn nếu STA fail)");
    ESP_LOGI(TAG, "    BLE       = OFF");
    ESP_LOGI(TAG, "    MIC       = OFF");
    ESP_LOGI(TAG, "    AUDIO     = OFF");
    ESP_LOGI(TAG, "    BUTTON    = OFF");
    ESP_LOGI(TAG, "    SPIFFS    = OFF");
    ESP_LOGI(TAG, "    HTTP      = OFF");
    ESP_LOGI(TAG, "    OLED      = OFF");
    ESP_LOGI(TAG, "=========================================================");
}

/* Gọi từ wifi_manager nếu cần — ở đây em chỉ include header để gọi API */
extern bool wifi_try_connect_saved(int timeout_ms);
extern void wifi_start_config_portal(void);
extern bool wifi_is_connected(void);
extern bool wifi_load_credentials(char *ssid, int ssid_len,
                                  char *pass, int pass_len);

/* ---------------------------------------------------------------------------
 * Hàm debug: in chi tiết WiFi credentials trong NVS
 * --------------------------------------------------------------------------- */
static void dump_nvs_credentials(void)
{
    char ssid[33] = {0};
    char pass[65] = {0};

    if (!wifi_load_credentials(ssid, sizeof(ssid), pass, sizeof(pass)))
    {
        ESP_LOGW(TAG, "NVS: no saved WiFi credentials");
        return;
    }

    ESP_LOGI(TAG, "NVS saved credentials:");
    ESP_LOGI(TAG, "  SSID = '%s' (len=%u)", ssid, (unsigned)strlen(ssid));
    ESP_LOGI(TAG, "  PASS = '%s' (len=%u)", pass, (unsigned)strlen(pass));

    /* Sanity check: SSID rỗng hoặc có ký tự lạ → cảnh báo */
    bool ssid_ok = (strlen(ssid) > 0 && strlen(ssid) < 32);
    if (!ssid_ok)
    {
        ESP_LOGE(TAG, "  ⚠️  SSID INVALID — sẽ fail khi connect");
    }
}

/* ---------------------------------------------------------------------------
 * Hàm debug: kiểm tra stack watermark và heap
 * --------------------------------------------------------------------------- */
static void print_system_info(void)
{
    ESP_LOGI(TAG, "Free heap: %u bytes",
             (unsigned)heap_caps_get_free_size(MALLOC_CAP_8BIT));
    ESP_LOGI(TAG, "Min free heap: %u bytes",
             (unsigned)heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT));
}

/* ---------------------------------------------------------------------------
 * Main app — chỉ WiFi, không gì khác
 * --------------------------------------------------------------------------- */
void app_main(void)
{
    /* In version NGAY ĐẦU TIÊN để dễ check đã flash đúng bản chưa */
    print_firmware_version();

    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "  LUMO WiFi-Only DEBUG firmware");
    ESP_LOGI(TAG, "  TẤT CẢ tính năng khác đã bị TẮT");
    ESP_LOGI(TAG, "  Chỉ chạy: NVS init + WiFi connect/AP");
    ESP_LOGI(TAG, "");

    /* Bước 1: NVS init (BẮT BUỘC để đọc WiFi saved) */
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES ||
        err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_LOGW(TAG, "NVS needs erase, doing nvs_flash_erase()");
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);
    ESP_LOGI(TAG, "NVS init OK");

    /* Bước 2: In WiFi credentials đã lưu */
    dump_nvs_credentials();

    /* Bước 3: In thông tin hệ thống */
    print_system_info();

    /* Bước 4: Thử connect WiFi saved (timeout 15s) */
    ESP_LOGI(TAG, "Calling wifi_try_connect_saved(15000)...");
    bool connected = wifi_try_connect_saved(15000);

    if (connected)
    {
        ESP_LOGI(TAG, "✅ WiFi CONNECTED");
        ESP_LOGI(TAG, "Hostname: lumo-hub");
        ESP_LOGI(TAG, "→ Cứ để firmware chạy, không có task nào khác");
    }
    else
    {
        ESP_LOGW(TAG, "❌ WiFi FAILED → starting config portal");
        ESP_LOGI(TAG, "");
        ESP_LOGI(TAG, "╔════════════════════════════════════════════╗");
        ESP_LOGI(TAG, "║  AP mode: SSID = LUMO_SETUP                ║");
        ESP_LOGI(TAG, "║           PASS = 12345678                  ║");
        ESP_LOGI(TAG, "║           IP   = 192.168.4.1              ║");
        ESP_LOGI(TAG, "║                                            ║");
        ESP_LOGI(TAG, "║  AP sẽ chạy VĨNH VIỄN cho tới khi reboot  ║");
        ESP_LOGI(TAG, "╚════════════════════════════════════════════╝");
        ESP_LOGI(TAG, "");

        /* Start AP mode + captive portal */
        wifi_start_config_portal();

        /* Verify AP thực sự bật */
        vTaskDelay(pdMS_TO_TICKS(2000));
        ESP_LOGI(TAG, "Config portal started. Test điện thoại ngay bây giờ.");
    }

    /* Bước 5: loop vô tận — chỉ log định kỳ, không làm gì khác */
    int counter = 0;
    for (;;)
    {
        vTaskDelay(pdMS_TO_TICKS(10000));   /* 10s */
        counter++;

        bool connected_now = wifi_is_connected();
        ESP_LOGI(TAG, "[t=%ds] WiFi=%s heap=%u",
                 counter * 10,
                 connected_now ? "CONNECTED" : "DISCONNECTED",
                 (unsigned)heap_caps_get_free_size(MALLOC_CAP_8BIT));

        /* Cứ 30s in thêm thông tin AP để debug */
        if (counter % 3 == 0)
        {
            ESP_LOGI(TAG, "AP LUMO_SETUP đang chạy. Quét WiFi trên điện thoại.");
        }
    }
}
