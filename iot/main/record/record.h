#pragma once

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C"
{
#endif

    /**
     * @brief Cấu hình recorder
     */
    typedef struct
    {
        const char *output_path; // VD: "/spiffs/record.wav"
        int sample_rate;         // Phải khớp với mic_config_t.sample_rate, VD: 16000
        int duration_ms;         // > 0: tự dừng sau N ms | 0: chạy đến khi recorder_stop()
    } recorder_config_t;

    /**
     * @brief Bắt đầu record (non-blocking).
     *        - Nếu duration_ms > 0: tự dừng sau đúng thời gian đó.
     *        - Nếu duration_ms = 0: chạy mãi đến khi gọi recorder_stop().
     *        Mic phải đã được init + start trước khi gọi.
     */
    esp_err_t recorder_start(const recorder_config_t *cfg);

    /**
     * @brief Dừng record thủ công, hoàn tất file WAV và giải phóng tài nguyên.
     *        Có thể gọi bất cứ lúc nào, kể cả khi đang dùng duration_ms.
     *        Blocking cho đến khi task record kết thúc hoàn toàn.
     */
    esp_err_t recorder_stop(void);

    /**
     * @brief Kiểm tra recorder đang chạy hay không.
     */
    bool recorder_is_recording(void);

#ifdef __cplusplus
}
#endif