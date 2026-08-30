#include <inttypes.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "lumo_band";

void app_main(void)
{
    uint32_t counter = 0;

    ESP_LOGI(TAG, "================================");
    ESP_LOGI(TAG, " LUMO-BAND ESP32-C3 SUPERMINI");
    ESP_LOGI(TAG, " ESP-IDF flash and console OK");
    ESP_LOGI(TAG, "================================");

    while (1) {
        ESP_LOGI(TAG, "Lumo-Band running: %" PRIu32 " second(s)", counter++);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
