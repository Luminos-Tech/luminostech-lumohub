#include "esp_log.h"

#include "ble/lumo_band_central.h"
#include "lumo_runtime.h"

/* Chay record test 5s o moi boot: ghi ra /spiffs/record.wav, verify header,
 * sau do dump base64 qua UART de PC bat va decode (===B64BEGIN=== ... ===B64END===).
 * Dong thoi van mo mic level log de theo doi rms theo thoi gian thuc. */
static const lumo_feature_config_t FEATURES = {
    .storage = true,
    .microphone = false,
    .microphone_level_log = false,
    .microphone_record_test = false,
    .button = false,
    .audio = false,
    .display = false,
    .network = true,
    .server_events = false,
    .voice_assistant = false,
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
