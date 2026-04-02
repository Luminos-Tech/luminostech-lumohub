#include "button.h"
#include <stddef.h>
#include "driver/gpio.h"

esp_err_t button_init(button_t *btn, gpio_num_t pin, uint8_t active_level, uint32_t debounce_ms)
{
    if (btn == NULL)
    {
        return ESP_ERR_INVALID_ARG;
    }

    btn->pin = pin;
    btn->active_level = active_level ? 1 : 0;
    btn->debounce_ms = debounce_ms;
    btn->clicked_event = false;

    // ── FIX: Reset pin trước khi config ──────────────────────────────
    // GPIO 39-42 trên ESP32-S3 là chân JTAG (MTCK/MTDO/MTDI/MTMS).
    // Boot ROM giữ chúng ở chế độ JTAG, gpio_config() thông thường
    // không đủ để override → GPIO đọc sai hoặc không đọc được.
    // gpio_reset_pin() trả chân về GPIO thường trước khi cấu hình.
    gpio_reset_pin(pin);

    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << pin),
        .mode = GPIO_MODE_INPUT,
        // ── FIX: Bật pull-down nội làm lớp bảo vệ thêm ──────────────
        // Dù đã có điện trở ngoài, pull-down nội giúp tránh GPIO lơ lửng
        // nếu dây ngoài tiếp xúc kém. Kéo song song không ảnh hưởng logic.
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = (active_level == 1) ? GPIO_PULLDOWN_ENABLE : GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };

    esp_err_t ret = gpio_config(&io_conf);
    if (ret != ESP_OK)
    {
        return ret;
    }

    int raw = gpio_get_level(pin);
    btn->last_raw_state = raw;
    btn->stable_state = raw;
    btn->last_stable_state = raw;
    btn->last_change_time_ms = 0;

    return ESP_OK;
}

void button_update(button_t *btn, uint32_t now_ms)
{
    if (btn == NULL)
    {
        return;
    }

    int raw = gpio_get_level(btn->pin);

    if (raw != btn->last_raw_state)
    {
        btn->last_raw_state = raw;
        btn->last_change_time_ms = now_ms;
    }

    if ((now_ms - btn->last_change_time_ms) >= btn->debounce_ms)
    {
        if (btn->stable_state != btn->last_raw_state)
        {
            btn->last_stable_state = btn->stable_state;
            btn->stable_state = btn->last_raw_state;

            bool was_pressed = (btn->last_stable_state == btn->active_level);
            bool now_released = (btn->stable_state != btn->active_level);

            if (was_pressed && now_released)
            {
                btn->clicked_event = true;
            }
        }
    }
}

bool button_is_pressed(button_t *btn)
{
    if (btn == NULL)
    {
        return false;
    }

    return (btn->stable_state == btn->active_level);
}

bool button_is_clicked(button_t *btn)
{
    if (btn == NULL)
    {
        return false;
    }

    if (btn->clicked_event)
    {
        btn->clicked_event = false;
        return true;
    }

    return false;
}