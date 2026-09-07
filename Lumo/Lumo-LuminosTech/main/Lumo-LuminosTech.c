#include "esp_log.h"

#include "ble/lumo_band_central.h"
#include "lumo_runtime.h"

/* Full voice stack:
 *  - WiFi + HTTP: để POST record.wav lên /audio/ của backend
 *  - Mic + record 5s: lấy audio người dùng
 *  - Audio playback: phát response.wav server trả về
 *  - Button GPIO42: bấm để bắt đầu voice interaction
 *  - BLE central: giữ nguyên để scan Lumo Band (không dùng cho voice)
 *  - mic_record_test: tắt (đã xong test 5s) — không xung đột mic resource */
static const lumo_feature_config_t FEATURES = {
    .storage = true,
    .microphone = true,
    .microphone_level_log = false,
    .microphone_record_test = false,
    .button = true,
    .audio = true,
    .display = false,           /* FIX: tắt OLED để loại trừ nguồn crash */
    .network = true,
    .server_events = false,
    .voice_assistant = true,
};

void app_main(void)
{
    esp_err_t err = lumo_band_central_start();
    if (err != ESP_OK)
    {
        ESP_LOGE("APP", "BLE central startup failed: %s", esp_err_to_name(err));
    }

    lumo_runtime_start(&FEATURES);
}
