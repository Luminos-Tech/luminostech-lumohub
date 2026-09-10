#include "esp_log.h"
#include "esp_app_desc.h"

#include "ble/lumo_band_central.h"
#include "lumo_runtime.h"

/* v0.5.1-test-no-oled: OLED đã TẮT hoàn toàn (không có phần cứng OLED).
 * Chỉ giữ: button + audio (mạch giải mã loa) + microphone. */
static const lumo_feature_config_t FEATURES = {
    .storage = true,
    .microphone = true,
    .microphone_level_log = true,  /* DEBUG: xem mic có hoạt động không */
    .microphone_record_test = false,
    .button = true,
    .audio = true,
    .network = true,
    .server_events = true,         /* BẬT button events lên server */
    .voice_assistant = true,
};

/* ============================================================================
 * LUMO FIRMWARE BUILD INFO — in ra đầu log để biết version nào đang chạy
 * ============================================================================
 * Khi thấy dòng "LUMO FW VERSION:" là biết firmware mới đã flash thành công.
 * Nếu KHÔNG thấy dòng này → flash thất bại / flash cũ / cache cũ.
 *
 * Nếu muốn tăng version: sửa LUMO_FW_VERSION_STRING bên dưới, build lại,
 * flash lại. Mỗi lần thay đổi code quan trọng nên bump version lên 1.
 * ============================================================================ */
#define LUMO_FW_VERSION_STRING  "v0.5.5-test-fix-wdt-feed"   /* Fix task_wdt panic: feed WDT trong streaming upload loop */
#define LUMO_FW_BUILD_DATE      __DATE__
#define LUMO_FW_BUILD_TIME      __TIME__

static void print_firmware_version(void)
{
    const esp_app_desc_t *app_desc = esp_app_get_description();

    ESP_LOGI("LUMO", "=========================================================");
    ESP_LOGI("LUMO", "  LUMO FIRMWARE BUILD INFO");
    ESP_LOGI("LUMO", "---------------------------------------------------------");
    ESP_LOGI("LUMO", "  App name      : %s", app_desc->project_name);
    ESP_LOGI("LUMO", "  App version   : %s", app_desc->version);
    ESP_LOGI("LUMO", "  IDF version   : %s", app_desc->idf_ver);
    ESP_LOGI("LUMO", "  Compile time  : %s %s", app_desc->date, app_desc->time);
    ESP_LOGI("LUMO", "  ELF SHA256    : %s...", app_desc->app_elf_sha256);
    ESP_LOGI("LUMO", "");
    ESP_LOGI("LUMO", "  >>> LUMO FW VERSION: %s <<<", LUMO_FW_VERSION_STRING);
    ESP_LOGI("LUMO", "  >>> BUILD DATE/TIME: %s %s <<<", LUMO_FW_BUILD_DATE, LUMO_FW_BUILD_TIME);
    ESP_LOGI("LUMO", "");
    ESP_LOGI("LUMO", "  ACTIVE FEATURES (this build):");
    ESP_LOGI("LUMO", "    storage            = %d", (int)FEATURES.storage);
    ESP_LOGI("LUMO", "    microphone         = %d", (int)FEATURES.microphone);
    ESP_LOGI("LUMO", "    mic_level_log      = %d", (int)FEATURES.microphone_level_log);
    ESP_LOGI("LUMO", "    mic_record_test    = %d", (int)FEATURES.microphone_record_test);
    ESP_LOGI("LUMO", "    button             = %d", (int)FEATURES.button);
    ESP_LOGI("LUMO", "    audio              = %d", (int)FEATURES.audio);
    ESP_LOGI("LUMO", "    network (WiFi)     = %d", (int)FEATURES.network);
    ESP_LOGI("LUMO", "    server_events      = %d", (int)FEATURES.server_events);
    ESP_LOGI("LUMO", "    voice_assistant    = %d", (int)FEATURES.voice_assistant);
    ESP_LOGI("LUMO", "    BLE central        = %d", 1);
    ESP_LOGI("LUMO", "");
    ESP_LOGW("LUMO", "  ! LONG PRESS BUTTON 5s to factory-reset WiFi credentials !");
    ESP_LOGI("LUMO", "=========================================================");
}

void app_main(void)
{
    /* In version NGAY ĐẦU TIÊN để dễ check đã flash đúng bản chưa */
    print_firmware_version();

    /* BLE central: kết nối wearable LUMO Band để nhận dữ liệu cảm biến */
    esp_err_t err = lumo_band_central_start();
    if (err != ESP_OK)
    {
        ESP_LOGE("APP", "BLE central startup failed: %s", esp_err_to_name(err));
    }

    lumo_runtime_start(&FEATURES);
}
