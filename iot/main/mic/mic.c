#include "mic.h"

#include <string.h>
#include <stdlib.h>
#include <stdint.h>

#include "esp_log.h"
#include "driver/i2s_std.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "MIC";

static i2s_chan_handle_t s_rx_handle = NULL;
static mic_config_t s_cfg = {0};
static bool s_initialized = false;
static bool s_running = false;
static size_t s_frame_samples = 0;

/**
 * Hầu hết MEMS mic (INMP441, SPH0645...) xuất 24-bit LEFT-JUSTIFIED
 * trong slot 32-bit: [bit31..bit8] = data, [bit7..bit0] = 0
 * Để lấy PCM16 đúng phải shift >> 16 (lấy 16 bit cao nhất).
 */
static inline int16_t raw_to_pcm16(int32_t raw_sample)
{
    int32_t s16 = raw_sample >> 16;

    if (s16 > 32767)
        s16 = 32767;
    if (s16 < -32768)
        s16 = -32768;

    return (int16_t)s16;
}

esp_err_t mic_init(const mic_config_t *cfg)
{
    if (cfg == NULL)
        return ESP_ERR_INVALID_ARG;

    if (cfg->sample_rate <= 0 || cfg->frame_ms <= 0)
        return ESP_ERR_INVALID_ARG;

    if (s_initialized)
    {
        ESP_LOGW(TAG, "Already initialized");
        return ESP_OK;
    }

    s_cfg = *cfg;
    s_frame_samples = (size_t)((s_cfg.sample_rate * s_cfg.frame_ms) / 1000);

    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    chan_cfg.auto_clear = true;

    esp_err_t err = i2s_new_channel(&chan_cfg, NULL, &s_rx_handle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_new_channel failed: %s", esp_err_to_name(err));
        return err;
    }

    /**
     * Mic chỉ có 1 kênh (L/R = GND → LEFT channel).
     * MONO + SLOT_LEFT đọc thẳng chỉ kênh trái, sạch hơn STEREO.
     */
    i2s_std_slot_config_t slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
        I2S_DATA_BIT_WIDTH_32BIT,
        I2S_SLOT_MODE_MONO);

    slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG((uint32_t)s_cfg.sample_rate),
        .slot_cfg = slot_cfg,
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = s_cfg.bck_io_num,
            .ws = s_cfg.ws_io_num,
            .dout = I2S_GPIO_UNUSED,
            .din = s_cfg.data_in_num,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };

    err = i2s_channel_init_std_mode(s_rx_handle, &std_cfg);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_channel_init_std_mode failed: %s", esp_err_to_name(err));
        i2s_del_channel(s_rx_handle);
        s_rx_handle = NULL;
        return err;
    }

    s_initialized = true;
    s_running = false;

    ESP_LOGI(TAG,
             "Mic initialized: rate=%d, frame_ms=%d, frame_samples=%u, BCK=%d, WS=%d, DIN=%d",
             s_cfg.sample_rate, s_cfg.frame_ms, (unsigned)s_frame_samples,
             s_cfg.bck_io_num, s_cfg.ws_io_num, s_cfg.data_in_num);

    return ESP_OK;
}

esp_err_t mic_start(void)
{
    if (!s_initialized || s_rx_handle == NULL)
        return ESP_ERR_INVALID_STATE;

    if (s_running)
        return ESP_OK;

    esp_err_t err = i2s_channel_enable(s_rx_handle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_channel_enable failed: %s", esp_err_to_name(err));
        return err;
    }

    s_running = true;
    ESP_LOGI(TAG, "Mic started");
    return ESP_OK;
}

esp_err_t mic_stop(void)
{
    if (!s_initialized || s_rx_handle == NULL)
        return ESP_ERR_INVALID_STATE;

    if (!s_running)
        return ESP_OK;

    esp_err_t err = i2s_channel_disable(s_rx_handle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_channel_disable failed: %s", esp_err_to_name(err));
        return err;
    }

    s_running = false;
    ESP_LOGI(TAG, "Mic stopped");
    return ESP_OK;
}

esp_err_t mic_deinit(void)
{
    if (!s_initialized)
        return ESP_OK;

    if (s_running)
        mic_stop();

    if (s_rx_handle)
    {
        i2s_del_channel(s_rx_handle);
        s_rx_handle = NULL;
    }

    memset(&s_cfg, 0, sizeof(s_cfg));
    s_frame_samples = 0;
    s_initialized = false;
    s_running = false;

    ESP_LOGI(TAG, "Mic deinitialized");
    return ESP_OK;
}

bool mic_is_running(void)
{
    return s_running;
}

size_t mic_get_frame_samples(void)
{
    return s_frame_samples;
}

int mic_get_sample_rate(void)
{
    return s_cfg.sample_rate;
}

esp_err_t mic_read_frame(int16_t *buffer, size_t samples_capacity, size_t *samples_read)
{
    if (!s_initialized || !s_running || s_rx_handle == NULL)
        return ESP_ERR_INVALID_STATE;

    if (buffer == NULL || samples_read == NULL)
        return ESP_ERR_INVALID_ARG;

    if (samples_capacity < s_frame_samples)
        return ESP_ERR_INVALID_SIZE;

    /* MONO mode → mỗi sample chỉ có 1 slot 32-bit */
    size_t raw_bytes_needed = s_frame_samples * sizeof(int32_t);

    int32_t *raw_buffer = (int32_t *)malloc(raw_bytes_needed);
    if (raw_buffer == NULL)
        return ESP_ERR_NO_MEM;

    size_t bytes_read = 0;
    esp_err_t err = i2s_channel_read(
        s_rx_handle,
        raw_buffer,
        raw_bytes_needed,
        &bytes_read,
        portMAX_DELAY);

    if (err != ESP_OK)
    {
        free(raw_buffer);
        ESP_LOGE(TAG, "i2s_channel_read failed: %s", esp_err_to_name(err));
        return err;
    }

    size_t raw_count = bytes_read / sizeof(int32_t);
    size_t out_count = 0;

    for (size_t i = 0; i < raw_count && out_count < s_frame_samples; i++)
    {
        buffer[out_count++] = raw_to_pcm16(raw_buffer[i]);
    }

    free(raw_buffer);

    // ── FIX: Lọc isolated spike của INMP441 ──────────────────────────
    // INMP441 đôi khi mất word-sync tại boundary DMA buffer, tạo ra
    // 1 sample cận INT16_MAX đứng lẻ giữa các sample gần 0:
    //   pattern: [..., 0, 0, 0, 32752, -22, -25, ...]
    // Tiếng nghe thành "click" đều đặn ~5 lần/giây.
    // Fix: nếu sample hiện tại vượt ngưỡng 20000 nhưng 2 hàng xóm
    // đều dưới 500 → đây là spike đơn lẻ, thay bằng 0.
    for (size_t i = 1; i + 1 < out_count; i++)
    {
        int32_t prev = (int32_t)buffer[i - 1];
        int32_t curr = (int32_t)buffer[i];
        int32_t next = (int32_t)buffer[i + 1];

        if (prev < 0)
            prev = -prev;
        if (curr < 0)
            curr = -curr;
        if (next < 0)
            next = -next;

        if (curr > 20000 && prev < 500 && next < 500)
        {
            buffer[i] = 0;
        }
    }
    // ─────────────────────────────────────────────────────────────────

    *samples_read = out_count;
    return ESP_OK;
}

esp_err_t mic_get_level(const int16_t *pcm, size_t samples, float *level_out)
{
    if (pcm == NULL || level_out == NULL || samples == 0)
        return ESP_ERR_INVALID_ARG;

    uint64_t sum = 0;
    for (size_t i = 0; i < samples; i++)
    {
        int32_t v = pcm[i];
        if (v < 0)
            v = -v;
        sum += (uint32_t)v;
    }

    float avg = (float)sum / (float)samples;
    *level_out = avg / 32768.0f;
    return ESP_OK;
}

bool mic_is_silence(const int16_t *pcm, size_t samples, float threshold)
{
    if (pcm == NULL || samples == 0)
        return true;

    float level = 0.0f;
    if (mic_get_level(pcm, samples, &level) != ESP_OK)
        return true;

    return level < threshold;
}