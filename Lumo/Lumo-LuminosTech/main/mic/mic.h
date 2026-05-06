#pragma once

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C"
{
#endif

    typedef struct
    {
        int sample_rate; // ví dụ 16000
        int frame_ms;    // ví dụ 100 ms
        int bck_io_num;  // SCK
        int ws_io_num;   // WS
        int data_in_num; // SD
    } mic_config_t;

    esp_err_t mic_init(const mic_config_t *cfg);
    esp_err_t mic_start(void);
    esp_err_t mic_stop(void);
    esp_err_t mic_deinit(void);

    bool mic_is_running(void);

    /** Số samples cho 1 frame theo config hiện tại */
    size_t mic_get_frame_samples(void);

    /** Sample rate hiện tại (Hz) */
    int mic_get_sample_rate(void);

    /**
     * Đọc 1 frame PCM16 mono.
     * buffer           : mảng int16_t do caller cấp phát
     * samples_capacity : số sample tối đa buffer chứa được
     * samples_read     : số sample thực tế đọc được
     */
    esp_err_t mic_read_frame(int16_t *buffer, size_t samples_capacity, size_t *samples_read);

    /** Tính level từ buffer PCM16, trả về 0.0 -> 1.0 */
    esp_err_t mic_get_level(const int16_t *pcm, size_t samples, float *level_out);

    bool mic_is_silence(const int16_t *pcm, size_t samples, float threshold);

#ifdef __cplusplus
}
#endif