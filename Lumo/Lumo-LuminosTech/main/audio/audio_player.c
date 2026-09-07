#include "audio_player.h"

#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2s_std.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_timer.h"

static const char *TAG = "AUDIO";
static volatile bool s_stop_requested = false;
static volatile bool s_is_playing = false;

static i2s_chan_handle_t s_tx_handle = NULL;
static int s_bclk_gpio = -1;
static int s_lrck_gpio = -1;
static int s_dout_gpio = -1;
static bool s_i2s_ready = false;

/** Minimum I2S clock stability settle time (ms) after reinit */
#define I2S_SETTLE_MS 5

typedef struct
{
    uint16_t audio_format; // PCM = 1
    uint16_t num_channels; // 1 mono, 2 stereo
    uint32_t sample_rate;
    uint16_t bits_per_sample;
    uint32_t data_offset;
    uint32_t data_size; // even-rounded
} wav_info_t;

static uint16_t read_le16(const uint8_t *p)
{
    return (uint16_t)(p[0] | (p[1] << 8));
}

static uint32_t read_le32(const uint8_t *p)
{
    return (uint32_t)(p[0] |
                      (p[1] << 8) |
                      (p[2] << 16) |
                      (p[3] << 24));
}

static esp_err_t audio_reinit_i2s(uint32_t sample_rate)
{
    esp_err_t ret;

    if (s_i2s_ready && s_tx_handle != NULL)
    {
        ret = i2s_channel_disable(s_tx_handle);
        if (ret != ESP_OK)
        {
            ESP_LOGE(TAG, "i2s_channel_disable failed: %s", esp_err_to_name(ret));
            return ret;
        }

        ret = i2s_del_channel(s_tx_handle);
        if (ret != ESP_OK)
        {
            ESP_LOGE(TAG, "i2s_del_channel failed: %s", esp_err_to_name(ret));
            return ret;
        }

        s_tx_handle = NULL;
        s_i2s_ready = false;
    }

    i2s_chan_config_t chan_cfg =
        I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);

    ret = i2s_new_channel(&chan_cfg, &s_tx_handle, NULL);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "i2s_new_channel failed: %s", esp_err_to_name(ret));
        return ret;
    }

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(sample_rate),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_16BIT,
            I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = s_bclk_gpio,
            .ws = s_lrck_gpio,
            .dout = s_dout_gpio,
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
        /* FIX (HIGH-2): i2s_new_channel() đã allocate s_tx_handle nhưng init
         * mode fail — phải del channel để tránh leak + double alloc lần sau. */
        ESP_LOGE(TAG, "i2s_channel_init_std_mode failed: %s",
                 esp_err_to_name(ret));
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

    s_i2s_ready = true;

    /* Allow I2S clock fractional divider to settle before streaming data.
     * Without this delay, the first few samples can have incorrect timing,
     * causing audible clicks or pitch jitter at the start of each playback. */
    vTaskDelay(pdMS_TO_TICKS(I2S_SETTLE_MS));

    ESP_LOGI(TAG, "I2S ready, sample_rate=%lu", (unsigned long)sample_rate);
    return ESP_OK;
}

static esp_err_t parse_wav_file(FILE *fp, wav_info_t *info)
{
    uint8_t header[12];

    if (fp == NULL || info == NULL)
    {
        ESP_LOGE(TAG, "parse_wav_file invalid arg");
        return ESP_ERR_INVALID_ARG;
    }

    if (fseek(fp, 0, SEEK_SET) != 0)
    {
        ESP_LOGE(TAG, "fseek to start failed");
        return ESP_FAIL;
    }

    if (fread(header, 1, sizeof(header), fp) != sizeof(header))
    {
        ESP_LOGE(TAG, "read 12-byte WAV header failed");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "WAV header: %.4s .... %.4s", header, header + 8);

    if (memcmp(header, "RIFF", 4) != 0 || memcmp(header + 8, "WAVE", 4) != 0)
    {
        ESP_LOGE(TAG, "Not a valid WAV file");
        return ESP_FAIL;
    }

    memset(info, 0, sizeof(*info));

    while (1)
    {
        uint8_t chunk_hdr[8];
        size_t n = fread(chunk_hdr, 1, sizeof(chunk_hdr), fp);
        if (n != sizeof(chunk_hdr))
        {
            ESP_LOGW(TAG, "Reached end of chunk list");
            break;
        }

        uint32_t chunk_size = read_le32(chunk_hdr + 4);
        long chunk_data_pos = ftell(fp);

        char chunk_name[5] = {0};
        memcpy(chunk_name, chunk_hdr, 4);

        ESP_LOGI(TAG, "chunk='%s' size=%lu pos=%ld",
                 chunk_name, (unsigned long)chunk_size, chunk_data_pos);

        if (memcmp(chunk_hdr, "fmt ", 4) == 0)
        {
            uint8_t fmt_buf[32];
            if (chunk_size < 16 || chunk_size > sizeof(fmt_buf))
            {
                ESP_LOGE(TAG, "Unsupported fmt chunk size=%lu", (unsigned long)chunk_size);
                return ESP_ERR_NOT_SUPPORTED;
            }

            if (fread(fmt_buf, 1, chunk_size, fp) != chunk_size)
            {
                ESP_LOGE(TAG, "read fmt chunk failed");
                return ESP_FAIL;
            }

            info->audio_format = read_le16(fmt_buf + 0);
            info->num_channels = read_le16(fmt_buf + 2);
            info->sample_rate = read_le32(fmt_buf + 4);
            info->bits_per_sample = read_le16(fmt_buf + 14);

            ESP_LOGI(TAG,
                     "fmt: format=%u channels=%u rate=%lu bits=%u",
                     info->audio_format,
                     info->num_channels,
                     (unsigned long)info->sample_rate,
                     info->bits_per_sample);
        }
        else if (memcmp(chunk_hdr, "data", 4) == 0)
        {
            info->data_offset = (uint32_t)chunk_data_pos;
            /* Round down to even so we never read a half-sample.
             * Odd-byte file → silent last byte, no click/pop artifact. */
            info->data_size = chunk_size & ~1U;

            if (chunk_size != info->data_size)
            {
                ESP_LOGW(TAG, "Odd-byte WAV data (size=%lu) — rounding to %lu",
                         (unsigned long)chunk_size,
                         (unsigned long)info->data_size);
            }

            ESP_LOGI(TAG, "data: offset=%lu size=%lu",
                     (unsigned long)info->data_offset,
                     (unsigned long)info->data_size);

            break;
        }
        else
        {
            ESP_LOGW(TAG, "skip unknown chunk '%s'", chunk_name);
            if (fseek(fp, chunk_size, SEEK_CUR) != 0)
            {
                ESP_LOGE(TAG, "skip unknown chunk failed");
                return ESP_FAIL;
            }
        }

        if (chunk_size & 1)
        {
            if (fseek(fp, 1, SEEK_CUR) != 0)
            {
                ESP_LOGE(TAG, "skip padding byte failed");
                return ESP_FAIL;
            }
        }
    }

    if (info->audio_format != 1)
    {
        ESP_LOGE(TAG, "Only PCM WAV supported, got format=%u", info->audio_format);
        return ESP_ERR_NOT_SUPPORTED;
    }

    if (info->bits_per_sample != 16)
    {
        ESP_LOGE(TAG, "Only 16-bit WAV supported, got %u-bit", info->bits_per_sample);
        return ESP_ERR_NOT_SUPPORTED;
    }

    if (info->num_channels != 1 && info->num_channels != 2)
    {
        ESP_LOGE(TAG, "Only mono/stereo supported, got channels=%u", info->num_channels);
        return ESP_ERR_NOT_SUPPORTED;
    }

    if (info->data_offset == 0 || info->data_size == 0)
    {
        ESP_LOGE(TAG, "No data chunk found");
        return ESP_FAIL;
    }

    return ESP_OK;
}

esp_err_t audio_init(int bclk_gpio, int lrck_gpio, int dout_gpio)
{
    if (bclk_gpio < 0 || lrck_gpio < 0 || dout_gpio < 0)
    {
        return ESP_ERR_INVALID_ARG;
    }

    s_bclk_gpio = bclk_gpio;
    s_lrck_gpio = lrck_gpio;
    s_dout_gpio = dout_gpio;
    s_i2s_ready = false;

    ESP_LOGI(TAG, "Audio init done");
    return ESP_OK;
}

esp_err_t audio_play(const char *filepath)
{
    if (filepath == NULL)
    {
        ESP_LOGE(TAG, "filepath is NULL");
        return ESP_ERR_INVALID_ARG;
    }

    ESP_LOGI(TAG, "Try open file: %s", filepath);

    FILE *fp = fopen(filepath, "rb");
    if (fp == NULL)
    {
        ESP_LOGE(TAG, "Cannot open file: %s", filepath);
        return ESP_ERR_NOT_FOUND;
    }

    wav_info_t info;
    esp_err_t ret = parse_wav_file(fp, &info);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "parse_wav_file failed: %s", esp_err_to_name(ret));
        fclose(fp);
        return ret;
    }

    ret = audio_reinit_i2s(info.sample_rate);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "audio_reinit_i2s failed: %s", esp_err_to_name(ret));
        fclose(fp);
        return ret;
    }

    if (fseek(fp, info.data_offset, SEEK_SET) != 0)
    {
        ESP_LOGE(TAG, "fseek to data offset failed");
        fclose(fp);
        return ESP_FAIL;
    }

    ESP_LOGI(TAG,
             "Playing %s (%lu Hz, %u ch, %u bit, %lu bytes)",
             filepath,
             (unsigned long)info.sample_rate,
             info.num_channels,
             info.bits_per_sample,
             (unsigned long)info.data_size);

    size_t remaining = info.data_size;
    size_t total_written = 0;

    if (info.num_channels == 2)
    {
        /* Stereo: direct passthrough, aligned to 4-byte chunks */
        uint8_t buf[1024];

        while (remaining > 0)
        {
            /* Round read request to multiple of 4 so DMA never sees
             * unaligned transfers that could cause timing glitches */
            size_t to_read = remaining > sizeof(buf) ? sizeof(buf)
                            : (remaining & ~3U);          // align to 4 bytes

            if (to_read == 0)
                break;

            size_t got = fread(buf, 1, to_read, fp);
            if (got == 0)
            {
                if (ferror(fp))
                {
                    ESP_LOGE(TAG, "fread stereo error");
                    fclose(fp);
                    return ESP_FAIL;
                }
                break; // EOF
            }

            size_t written = 0;
            ret = i2s_channel_write(
                s_tx_handle,
                buf,
                got,
                &written,
                portMAX_DELAY);

            if (ret != ESP_OK)
            {
                ESP_LOGE(TAG, "i2s_channel_write stereo failed: %s",
                         esp_err_to_name(ret));
                fclose(fp);
                return ret;
            }

            /* BUG FIX: use actual bytes_written, not requested bytes.
             * If DMA buffer is full, i2s_channel_write may write fewer bytes
             * than requested, causing 'remaining' to be decremented by the
             * wrong amount and audio to end prematurely or loop forever. */
            total_written += written;
            remaining -= written;

            if (written < got)
            {
                ESP_LOGW(TAG, "I2S buffer full — wrote %u/%u bytes, remaining=%u",
                         (unsigned)written, (unsigned)got, (unsigned)remaining);
                /* Seek back so we can retry unread bytes on next iteration */
                if (fseek(fp, -(long)(got - written), SEEK_CUR) != 0)
                {
                    ESP_LOGE(TAG, "fseek back failed");
                    fclose(fp);
                    return ESP_FAIL;
                }
            }
        }
    }
    else
    {
        /* Mono: convert to stereo (L=R) in-place.
         * mono_buf holds PCM16 samples (2 bytes each).
         * stereo_buf holds duplicated samples: [L0,R0,L1,R1,...]
         * 256 mono samples = 512 bytes → 512 stereo samples = 1024 bytes */
        int16_t mono_buf[256];
        int16_t stereo_buf[512];

        while (remaining > 0)
        {
            /* Read in multiples of 2 bytes (1 sample) so we never have a
             * half-sample. Round down to ensure alignment. */
            size_t mono_bytes = remaining > sizeof(mono_buf) ? sizeof(mono_buf)
                                : (remaining & ~1U);

            if (mono_bytes == 0)
                break;

            size_t got = fread(mono_buf, 1, mono_bytes, fp);
            if (got == 0)
            {
                if (ferror(fp))
                {
                    ESP_LOGE(TAG, "fread mono error");
                    fclose(fp);
                    return ESP_FAIL;
                }
                break;
            }

            /* got may be < mono_bytes only on short read (rare). */
            size_t mono_samples = got / sizeof(int16_t);  // always even, no truncation

            /* Convert mono → stereo (duplicate L to R) */
            for (size_t i = 0; i < mono_samples; i++)
            {
                stereo_buf[i * 2]     = mono_buf[i];
                stereo_buf[i * 2 + 1] = mono_buf[i];
            }

            size_t stereo_bytes = mono_samples * 2 * sizeof(int16_t);
            size_t written = 0;
            ret = i2s_channel_write(
                s_tx_handle,
                stereo_buf,
                stereo_bytes,
                &written,
                portMAX_DELAY);

            if (ret != ESP_OK)
            {
                ESP_LOGE(TAG, "i2s_channel_write mono failed: %s",
                         esp_err_to_name(ret));
                fclose(fp);
                return ret;
            }

            /* BUG FIX: use actual bytes_written to update remaining.
             * If the I2S DMA TX buffer is full (e.g. underrun or back-pressure
             * from slow peripheral), fewer bytes are accepted than requested.
             * Decrementing by 'stereo_bytes' instead of 'written' would
             * mis-calculate remaining and either:
             *   (a) read past EOF — garbage audio or loop
             *   (b) stop early — audio cuts off prematurely */
            size_t consumed = (written / (2 * sizeof(int16_t))) * sizeof(int16_t);
            total_written += consumed;
            remaining -= consumed;

            if (written < stereo_bytes)
            {
                ESP_LOGW(TAG,
                         "I2S mono underrun — wrote %u/%u bytes, remaining=%u",
                         (unsigned)written, (unsigned)stereo_bytes,
                         (unsigned)remaining);
            }
        }
    }

    fclose(fp);
    ESP_LOGI(TAG, "Done: %s (wrote %u bytes)", filepath, (unsigned)total_written);
    return ESP_OK;
}
