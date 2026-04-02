#include "record/record.h"
#include "mic/mic.h"

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

static const char *TAG = "RECORDER";

/* ------------------------------------------------------------------ */
/*  WAV header (44 bytes chuẩn, PCM mono 16-bit)                      */
/* ------------------------------------------------------------------ */

#pragma pack(push, 1)
typedef struct
{
    char riff_id[4];
    uint32_t riff_size;
    char wave_id[4];
    char fmt_id[4];
    uint32_t fmt_size;
    uint16_t audio_format;
    uint16_t num_channels;
    uint32_t sample_rate;
    uint32_t byte_rate;
    uint16_t block_align;
    uint16_t bits_per_sample;
    char data_id[4];
    uint32_t data_size;
} wav_header_t;
#pragma pack(pop)

static void wav_header_fill(wav_header_t *h, uint32_t sample_rate, uint32_t data_bytes)
{
    memcpy(h->riff_id, "RIFF", 4);
    memcpy(h->wave_id, "WAVE", 4);
    memcpy(h->fmt_id, "fmt ", 4);
    memcpy(h->data_id, "data", 4);

    h->fmt_size = 16;
    h->audio_format = 1;
    h->num_channels = 1;
    h->sample_rate = sample_rate;
    h->bits_per_sample = 16;
    h->block_align = 2;
    h->byte_rate = sample_rate * 2;
    h->data_size = data_bytes;
    h->riff_size = 36 + data_bytes;
}

/* ------------------------------------------------------------------ */
/*  State nội bộ                                                       */
/* ------------------------------------------------------------------ */

static TaskHandle_t s_task_handle = NULL;
static SemaphoreHandle_t s_done_sem = NULL;
static volatile bool s_stop_flag = false;
static volatile bool s_recording = false;

static recorder_config_t s_cfg = {0};

/* ------------------------------------------------------------------ */
/*  FreeRTOS task                                                      */
/* ------------------------------------------------------------------ */

static void recorder_task(void *arg)
{
    FILE *f = NULL;
    int16_t *frame_buf = NULL;
    uint32_t total_written = 0;
    esp_err_t err = ESP_OK;

    size_t frame_samples = mic_get_frame_samples();
    if (frame_samples == 0)
    {
        ESP_LOGE(TAG, "frame_samples = 0, mic chưa init?");
        goto cleanup;
    }

    frame_buf = (int16_t *)malloc(frame_samples * sizeof(int16_t));
    if (!frame_buf)
    {
        ESP_LOGE(TAG, "Không cấp được bộ nhớ");
        goto cleanup;
    }

    f = fopen(s_cfg.output_path, "wb");
    if (!f)
    {
        ESP_LOGE(TAG, "Không mở được file: %s", s_cfg.output_path);
        goto cleanup;
    }

    /* Placeholder header, cập nhật đúng khi dừng */
    wav_header_t header = {0};
    fwrite(&header, sizeof(wav_header_t), 1, f);

    /* Tính số samples tối đa nếu có duration_ms */
    uint32_t target_samples = 0;
    bool has_duration = (s_cfg.duration_ms > 0);
    if (has_duration)
    {
        target_samples = (uint32_t)((uint64_t)s_cfg.sample_rate * s_cfg.duration_ms / 1000);
        ESP_LOGI(TAG, "▶ Record %d ms (~%lu samples) => %s",
                 s_cfg.duration_ms, (unsigned long)target_samples, s_cfg.output_path);
    }
    else
    {
        ESP_LOGI(TAG, "▶ Record thủ công => %s (gọi recorder_stop() để dừng)",
                 s_cfg.output_path);
    }

    while (!s_stop_flag)
    {
        /* Dừng tự động nếu đã đủ duration */
        if (has_duration && total_written >= target_samples)
        {
            ESP_LOGI(TAG, "Đã đủ thời gian record, tự dừng");
            break;
        }

        size_t samples_read = 0;
        err = mic_read_frame(frame_buf, frame_samples, &samples_read);
        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "mic_read_frame lỗi: %s", esp_err_to_name(err));
            break;
        }

        /* Nếu có duration, clip frame cuối cho đúng */
        size_t samples_to_write = samples_read;
        if (has_duration && total_written + samples_to_write > target_samples)
        {
            samples_to_write = target_samples - total_written;
        }

        size_t written = fwrite(frame_buf, sizeof(int16_t), samples_to_write, f);
        if (written != samples_to_write)
        {
            ESP_LOGE(TAG, "fwrite thất bại");
            err = ESP_FAIL;
            break;
        }

        total_written += (uint32_t)samples_to_write;
    }

    /* Cập nhật WAV header thực tế */
    uint32_t data_bytes = total_written * sizeof(int16_t);
    rewind(f);
    wav_header_fill(&header, (uint32_t)s_cfg.sample_rate, data_bytes);
    fwrite(&header, sizeof(wav_header_t), 1, f);
    fclose(f);
    f = NULL;

    float duration_sec = (s_cfg.sample_rate > 0)
                             ? (float)total_written / (float)s_cfg.sample_rate
                             : 0.0f;

    ESP_LOGI(TAG, "■ Record xong: %.2f giây | %lu bytes | %s",
             duration_sec, (unsigned long)data_bytes, s_cfg.output_path);

cleanup:
    if (f)
        fclose(f);
    if (frame_buf)
        free(frame_buf);

    s_recording = false;
    s_task_handle = NULL;

    if (s_done_sem)
        xSemaphoreGive(s_done_sem);

    vTaskDelete(NULL);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

esp_err_t recorder_start(const recorder_config_t *cfg)
{
    if (!cfg || !cfg->output_path || cfg->sample_rate <= 0)
        return ESP_ERR_INVALID_ARG;

    if (s_recording)
    {
        ESP_LOGW(TAG, "Đang record rồi, gọi recorder_stop() trước");
        return ESP_ERR_INVALID_STATE;
    }

    if (!mic_is_running())
    {
        ESP_LOGE(TAG, "Mic chưa start");
        return ESP_ERR_INVALID_STATE;
    }

    s_cfg = *cfg;

    if (!s_done_sem)
    {
        s_done_sem = xSemaphoreCreateBinary();
        if (!s_done_sem)
            return ESP_ERR_NO_MEM;
    }

    s_stop_flag = false;
    s_recording = true;

    // ── FIX: Stack 4096 quá nhỏ cho fopen/fwrite trên SPIFFS + stdio buffers.
    // Tăng lên 8192 để tránh stack overflow âm thầm gây ghi file lỗi.
    BaseType_t ret = xTaskCreate(recorder_task, "recorder_task", 8192,
                                 NULL, 5, &s_task_handle);
    if (ret != pdPASS)
    {
        s_recording = false;
        ESP_LOGE(TAG, "Không tạo được recorder_task");
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

esp_err_t recorder_stop(void)
{
    if (!s_recording)
    {
        ESP_LOGW(TAG, "Recorder không chạy");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Đang dừng record...");
    s_stop_flag = true;

    if (s_done_sem)
        xSemaphoreTake(s_done_sem, portMAX_DELAY);

    return ESP_OK;
}

bool recorder_is_recording(void)
{
    return s_recording;
}