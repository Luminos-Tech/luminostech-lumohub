/*
 * button_test_main.c
 *
 * Chế độ TEST BUTTON thuần — chỉ dùng để kiểm tra nút nhấn hoạt động đúng không.
 *
 * KHÔNG chạy: WiFi, BLE, mic, OLED, audio player, HTTP server.
 * Chỉ in log ra serial mỗi lần nhấn nút.
 *
 * Bật/tắt qua menuconfig:
 *   idf.py menuconfig
 *     → Component config → Lumo → Test mode → Button only
 * Hoặc build thẳng với:
 *   idf.py -DBUTTON_TEST_MODE=1 build
 *
 * Sau khi test xong, build lại không có flag để về main code.
 */

#include <stdio.h>
#include <inttypes.h>
#include <stdbool.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "driver/gpio.h"
/* ESP-IDF v5.5: pull-up enum is now gpio_pullup_t {GPIO_PULLUP_ENABLE,
 * GPIO_PULLDOWN_ENABLE, GPIO_PULLUP_DISABLE}. */

#include "button.h"

static const char *TAG = "BUTTON_TEST";

/*
 * Phải khớp với main code: GPIO42, active LOW, debounce 5ms.
 * Xem lumo_runtime.c dòng BUTTON_GPIO.
 */
#define TEST_BUTTON_GPIO GPIO_NUM_42
#define TEST_BUTTON_ACTIVE_LEVEL 0
#define TEST_BUTTON_DEBOUNCE_MS 20

void app_main(void)
{
    ESP_LOGI(TAG, "=============================================");
    ESP_LOGI(TAG, "  BUTTON TEST MODE");
    ESP_LOGI(TAG, "  - WiFi: OFF");
    ESP_LOGI(TAG, "  - BLE: OFF");
    ESP_LOGI(TAG, "  - Mic: OFF");
    ESP_LOGI(TAG, "  - OLED: OFF");
    ESP_LOGI(TAG, "  - Audio: OFF");
    ESP_LOGI(TAG, "  - HTTP: OFF");
    ESP_LOGI(TAG, "  Chỉ đọc GPIO%u, active_level=%u, debounce=%ums",
             (unsigned)TEST_BUTTON_GPIO,
             (unsigned)TEST_BUTTON_ACTIVE_LEVEL,
             (unsigned)TEST_BUTTON_DEBOUNCE_MS);
    ESP_LOGI(TAG, "=============================================");

    button_t btn;
    esp_err_t err = button_init(&btn, TEST_BUTTON_GPIO,
                                TEST_BUTTON_ACTIVE_LEVEL,
                                TEST_BUTTON_DEBOUNCE_MS);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "button_init thất bại: %s", esp_err_to_name(err));
        while (1)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
    }

    /* Đọc mức hiện tại để xác định module nút đang ở trạng thái nào */
    int initial_level = gpio_get_level(TEST_BUTTON_GPIO);
    ESP_LOGI(TAG, "[INIT] GPIO%u raw level = %d",
             (unsigned)TEST_BUTTON_GPIO, initial_level);
    ESP_LOGI(TAG, "[INIT] Kỳ vọng: level=1 khi thả, level=0 khi nhấn");
    ESP_LOGI(TAG, "[INIT] Nếu lúc nào cũng đọc level=0, có thể chưa cấp nguồn module.");
    ESP_LOGI(TAG, "---------------------------------------------");

    /* Bộ đếm số lần bấm */
    uint32_t press_count = 0;
    uint32_t last_print_ms = 0;

    while (1)
    {
        uint32_t now_ms = (uint32_t)(esp_timer_get_time() / 1000);

        button_update(&btn, now_ms);

        /* 1. Phát hiện sự kiện click (nhấn rồi nhả) */
        if (button_is_clicked(&btn))
        {
            press_count++;
            ESP_LOGW(TAG, ">>> CLICK #%" PRIu32 " (nhấn-thả)  t=%" PRIu32 "ms",
                     press_count, now_ms);
            fflush(stdout);
        }

        /* 2. In raw level định kỳ 1 giây để bạn thấy module đang ở trạng thái nào */
        if (now_ms - last_print_ms >= 1000)
        {
            int raw = gpio_get_level(TEST_BUTTON_GPIO);
            ESP_LOGI(TAG,
                     "[HEARTBEAT] t=%" PRIu32 "ms  raw=GPIO%u=%d  stable=%s  clicks=%" PRIu32,
                     now_ms,
                     (unsigned)TEST_BUTTON_GPIO,
                     raw,
                     button_is_pressed(&btn) ? "PRESSED " : "released",
                     press_count);
            last_print_ms = now_ms;
        }

        vTaskDelay(pdMS_TO_TICKS(10)); /* poll 100 Hz, đủ nhanh cho debounce 20ms */
    }
}
