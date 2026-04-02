#include "audio_stream.h"

#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdatomic.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/i2s_std.h"
#include "esp_log.h"
#include "esp_err.h"

static const char *TAG = "AUDIO_STR";

#define STREAM_QUEUE_SIZE 8
#define STREAM_TASK_STACK 4096

static i2s_chan_handle_t s_tx_handle = NULL;
static TaskHandle_t s_task = NULL;
static QueueHandle_t s_queue = NULL;
static volatile atomic_bool s_stop = ATOMIC_VAR_INIT(false);
static volatile atomic_bool s_playing = ATOMIC_VAR_INIT(false);

static int s_bclk_gpio = -1;
static int s_ws_gpio = -1;
static int s_dout_gpio = -1;
static int s_sample_rate = 24000;

_Static_assert(sizeof(uint8_t) == 1, "uint8_t must be 1 byte");
_Static_assert(sizeof(int16_t) == 2, "int16_t must be 2 bytes");

// ─────────────────────────────────────────────────────────────
// Chuyển mono 16-bit → stereo 16-bit (LR interleaved)
// In-place: output phải đủ lớn (2x input)
// ─────────────────────────────────────────────────────────────
static void mono_to_stereo(const int16_t *mono, int16_t *stereo, size_t mono_samples)
{
    // Copy ngược từ cuối để không overwrite source
    for (size_t i = mono_samples; i-- > 0; )
    {
        int16_t s = mono[i];
        stereo[i * 2] = s;
        stereo[i * 2 + 1] = s;
    }
}

// ─────────────────────────────────────────────────────────────
// Task stream: lấy chunk từ queue, write I2S liên tục
// ─────────────────────────────────────────────────────────────
static void stream_task(void *arg)
{
    (void)arg;

    uint8_t buf[2048];  // workspace cho stereo

    while (!atomic_load(&s_stop))
    {
        if (s_queue == NULL)
        {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        // Chờ chunk mới
        uint8_t chunk[2048];
        BaseType_t ok = xQueueReceive(s_queue, chunk, pdMS_TO_TICKS(20));

        if (ok == pdTRUE)
        {
            // Lấy actual size từ header chunk đầu tiên
            // chunk format: [2-byte size LE][2-byte channels LE][pcm data...]
            if (chunk[2] == 1)  // mono
            {
                size_t mono_samples = (chunk[0] | (chunk[1] << 8)) / 2;  // bytes → samples
                mono_to_stereo((const int16_t *)(chunk + 4),
                               (int16_t *)buf,
                               mono_samples);
                size_t stereo_bytes = mono_samples * 2 * 2;

                size_t written = 0;
                esp_err_t ret = i2s_channel_write(s_tx_handle,
                                                   buf,
                                                   stereo_bytes,
                                                   &written,
                                                   pdMS_TO_TICKS(500));
                if (ret != ESP_OK)
                    ESP_LOGE(TAG, "i2s write mono failed: %s", esp_err_to_name(ret));
            }
            else if (chunk[2] == 2)  // stereo — gửi thẳng
            {
                size_t pcm_bytes = chunk[0] | (chunk[1] << 8);
                size_t written = 0;
                esp_err_t ret = i2s_channel_write(s_tx_handle,
                                                   chunk + 4,
                                                   pcm_bytes,
                                                   &written,
                                                   pdMS_TO_TICKS(500));
                if (ret != ESP_OK)
                    ESP_LOGE(TAG, "i2s write stereo failed: %s", esp_err_to_name(ret));
            }
        }
        else
        {
            // Queue trống → gửi silence ngắn để giữ sync
            memset(buf, 0, sizeof(buf));
            size_t written = 0;
            i2s_channel_write(s_tx_handle, buf, sizeof(buf), &written, pdMS_TO_TICKS(10));
        }
    }

    atomic_store(&s_playing, false);
    vTaskDelete(NULL);
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

esp_err_t audio_stream_init(int bclk_gpio, int ws_gpio, int dout_gpio, int sample_rate)
{
    if (bclk_gpio < 0 || ws_gpio < 0 || dout_gpio < 0 || sample_rate <= 0)
    {
        ESP_LOGE(TAG, "Invalid audio_stream_init params");
        return ESP_ERR_INVALID_ARG;
    }

    s_bclk_gpio = bclk_gpio;
    s_ws_gpio = ws_gpio;
    s_dout_gpio = dout_gpio;
    s_sample_rate = sample_rate;

    if (s_tx_handle != NULL)
        audio_stream_deinit();

    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    esp_err_t ret = i2s_new_channel(&chan_cfg, &s_tx_handle, NULL);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_new_channel failed: %s", esp_err_to_name(ret));
        return ret;
    }

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG((uint32_t)sample_rate),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_16BIT,
            I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = (gpio_num_t)bclk_gpio,
            .ws = (gpio_num_t)ws_gpio,
            .dout = (gpio_num_t)dout_gpio,
            .din = I2S_GPIO_UNUSED,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };

    ret = i2s_channel_init_std_mode(s_tx_handle, &std_cfg);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_channel_init_std_mode failed: %s", esp_err_to_name(ret));
        i2s_del_channel(s_tx_handle);
        s_tx_handle = NULL;
        return ret;
    }

    ret = i2s_channel_enable(s_tx_handle);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_channel_enable failed: %s", esp_err_to_name(ret));
        i2s_del_channel(s_tx_handle);
        s_tx_handle = NULL;
        return ret;
    }

    s_queue = xQueueCreate(STREAM_QUEUE_SIZE, 2048);
    if (s_queue == NULL)
    {
        ESP_LOGE(TAG, "xQueueCreate failed");
        i2s_channel_disable(s_tx_handle);
        i2s_del_channel(s_tx_handle);
        s_tx_handle = NULL;
        return ESP_ERR_NO_MEM;
    }

    atomic_store(&s_stop, false);
    atomic_store(&s_playing, true);

    BaseType_t task_ret = xTaskCreate(
        stream_task,
        "audio_stream",
        STREAM_TASK_STACK,
        NULL,
        5,
        &s_task);
    if (task_ret != pdPASS)
    {
        ESP_LOGE(TAG, "xTaskCreate stream_task failed");
        vQueueDelete(s_queue);
        s_queue = NULL;
        i2s_channel_disable(s_tx_handle);
        i2s_del_channel(s_tx_handle);
        s_tx_handle = NULL;
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "audio_stream init done (I2S DMA %d Hz)", sample_rate);
    return ESP_OK;
}

esp_err_t audio_stream_play(const uint8_t *pcm_data, size_t pcm_len)
{
    if (!s_tx_handle || !s_queue)
        return ESP_ERR_INVALID_STATE;

    if (pcm_len == 0 || pcm_len > 2048)
        return ESP_ERR_INVALID_ARG;

    // Đóng gói: [2-byte size][1-byte channels][1-byte flags][pcm]
    uint8_t packed[2048];
    // size (2 byte LE)
    packed[0] = (uint8_t)(pcm_len & 0xFF);
    packed[1] = (uint8_t)((pcm_len >> 8) & 0xFF);
    // channels (1=mono assumed)
    packed[2] = 1;
    // flags
    packed[3] = 0;
    // PCM data
    memcpy(packed + 4, pcm_data, pcm_len);

    BaseType_t ok = xQueueSend(s_queue, packed, pdMS_TO_TICKS(100));
    if (ok != pdTRUE)
        return ESP_FAIL;

    return ESP_OK;
}

void audio_stream_stop(void)
{
    if (s_queue)
        xQueueReset(s_queue);
}

void audio_stream_deinit(void)
{
    atomic_store(&s_stop, true);

    if (s_task)
    {
        vTaskDelete(s_task);
        s_task = NULL;
    }

    if (s_queue)
    {
        vQueueDelete(s_queue);
        s_queue = NULL;
    }

    if (s_tx_handle)
    {
        i2s_channel_disable(s_tx_handle);
        i2s_del_channel(s_tx_handle);
        s_tx_handle = NULL;
    }

    ESP_LOGI(TAG, "audio_stream deinit done");
}

bool audio_stream_is_playing(void)
{
    return atomic_load(&s_playing);
}
