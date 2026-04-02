#ifndef BUTTON_H
#define BUTTON_H

#include <stdbool.h>
#include "driver/gpio.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C"
{
#endif

    typedef struct
    {
        gpio_num_t pin;
        uint8_t active_level; // 0 hoặc 1
        uint32_t debounce_ms;

        // internal
        int last_raw_state;
        int stable_state;
        int last_stable_state;
        uint32_t last_change_time_ms;
        bool clicked_event;
    } button_t;

    /**
     * @brief Khởi tạo button
     *
     * @param btn          Con trỏ button_t
     * @param pin          GPIO dùng để đọc nút
     * @param active_level Mức logic khi nhấn: 0 hoặc 1
     * @param debounce_ms  Thời gian debounce, ví dụ 20~50ms
     *
     * @note Hàm tự gọi gpio_reset_pin() trước khi cấu hình,
     *       an toàn với các chân JTAG (GPIO39-42 trên ESP32-S3).
     */
    esp_err_t button_init(button_t *btn, gpio_num_t pin, uint8_t active_level, uint32_t debounce_ms);

    /**
     * @brief Gọi hàm này liên tục trong vòng lặp/task để cập nhật trạng thái nút
     */
    void button_update(button_t *btn, uint32_t now_ms);

    /**
     * @brief Nút đang được nhấn hay không
     */
    bool button_is_pressed(button_t *btn);

    /**
     * @brief Có sự kiện click mới hay không
     *
     * Trả về true 1 lần duy nhất khi phát hiện nhấn rồi nhả.
     */
    bool button_is_clicked(button_t *btn);

#ifdef __cplusplus
}
#endif

#endif