#include "button.h"
#include <stddef.h>

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
    btn->long_press_event = false;
    btn->long_press_ms = 0;
    btn->press_start_ms = 0;

    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << pin),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE};

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

    // Nếu raw state thay đổi thì reset bộ đếm debounce
    if (raw != btn->last_raw_state)
    {
        btn->last_raw_state = raw;
        btn->last_change_time_ms = now_ms;
    }

    // Sau debounce_ms mà vẫn giữ nguyên thì coi là stable
    if ((now_ms - btn->last_change_time_ms) >= btn->debounce_ms)
    {
        if (btn->stable_state != btn->last_raw_state)
        {
            btn->last_stable_state = btn->stable_state;
            btn->stable_state = btn->last_raw_state;

            // Detect down-edge: rising into "pressed"
            if (btn->stable_state == btn->active_level)
            {
                btn->press_start_ms = now_ms;
            }
            // Detect up-edge: was pressed, now released
            else if (btn->last_stable_state == btn->active_level)
            {
                if (btn->long_press_event)
                {
                    /* long press already consumed — reset */
                    btn->long_press_event = false;
                }
            }

            // Phát hiện click:
            // click = có nhấn rồi nhả
            bool was_pressed = (btn->last_stable_state == btn->active_level);
            bool now_released = (btn->stable_state != btn->active_level);

            if (was_pressed && now_released)
            {
                btn->clicked_event = true;
            }
        }
        else if (btn->stable_state == btn->active_level)
        {
            /* Still pressed — check if long-press threshold reached */
            if (!btn->long_press_event &&
                (now_ms - btn->press_start_ms) >= btn->long_press_ms &&
                btn->long_press_ms > 0)
            {
                btn->long_press_event = true;
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

uint32_t button_current_press_ms(button_t *btn, uint32_t now_ms)
{
    if (btn == NULL || btn->stable_state != btn->active_level)
    {
        return 0;
    }
    return now_ms - btn->press_start_ms;
}

bool button_is_long_pressed(button_t *btn, uint32_t long_press_ms)
{
    if (btn == NULL)
    {
        return false;
    }

    /* Lazy-set threshold whenever caller asks */
    if (long_press_ms != btn->long_press_ms)
    {
        btn->long_press_ms = long_press_ms;
    }

    if (btn->long_press_event)
    {
        btn->long_press_event = false;
        return true;
    }
    return false;
}