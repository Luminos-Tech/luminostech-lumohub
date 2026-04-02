#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

    /**
     * @brief Cấu hình & khởi tạo I2S DMA TX streaming.
     *        Gọi 1 lần khi khởi động. Sau đó gọi audio_stream_play() nhiều lần.
     *
     * @param bclk_gpio  GPIO chân BCLK  (I2S bit clock)
     * @param ws_gpio    GPIO chân WS    (word select / left-right clock)
     * @param dout_gpio  GPIO chân DOUT (data out)
     * @param sample_rate Sample rate, ví dụ 24000
     *
     * @return ESP_OK nếu thành công
     */
    esp_err_t audio_stream_init(int bclk_gpio, int ws_gpio, int dout_gpio, int sample_rate);

    /**
     * @brief Gửi 1 chunk PCM (raw 16-bit stereo interleaved) vào hàng đợi.
     *        Hàm không blocking (chỉ copy vào queue). Task stream sẽ write I2S.
     *
     * @param pcm_data  Pointer tới buffer PCM (phải là 16-bit stereo)
     * @param pcm_len   Kích thước buffer tính theo bytes
     *
     * @return ESP_OK nếu đã vào queue, ESP_FAIL nếu queue đầy
     */
    esp_err_t audio_stream_play(const uint8_t *pcm_data, size_t pcm_len);

    /**
     * @brief Dừng phát, xóa hết buffer trong queue.
     */
    void audio_stream_stop(void);

    /**
     * @brief Giải phóng I2S DMA. Gọi khi kết thúc phiên.
     */
    void audio_stream_deinit(void);

    /**
     * @brief Kiểm tra còn đang phát hay không.
     */
    bool audio_stream_is_playing(void);

#ifdef __cplusplus
}
#endif
