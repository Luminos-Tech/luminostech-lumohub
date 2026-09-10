/* ============================================================================
 * LUMO Audio Test Mode — phát checkLife.wav lặp lại liên tục
 * ----------------------------------------------------------------------------
 * Mục đích: test loa hoạt động ổn không, đo thời lượng pin 3.5V 5000mAh.
 *
 * Cách chạy:
 *   1. Đổi MODE trong main/CMakeLists.txt thành "audio_test"
 *   2. idf.py build
 *   3. idf.py -p COM3 flash monitor
 *   4. Quan sát log:
 *        - Số lần đã phát (PLAY_COUNT)
 *        - Tổng thời gian đã chạy (UPTIME)
 *        - Free heap mỗi 60s để phát hiện memory leak
 *   5. Pin yếu → loa rè/repeat fail → reboot
 *
 * Stop: nhấn nút RESET trên board (hoặc ngắt nguồn).
 *
 * File test: /spiffs/checkLife.wav (có sẵn trong SPIFFS partition 2.5MB)
 * ============================================================================ */

#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>

#include <dirent.h>
#include <sys/stat.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_log.h"
#include "esp_err.h"
#include "esp_app_desc.h"
#include "esp_heap_caps.h"
#include "nvs_flash.h"
#include "esp_spiffs.h"
#include "esp_timer.h"

#include "audio/audio_player.h"

static const char *TAG = "AUDIO_TEST";

/* GPIO pins cho I2S (MAX98357A) — match lumo_runtime.c */
#define AUDIO_BCLK_GPIO 5
#define AUDIO_LRCK_GPIO 4
#define AUDIO_DATA_GPIO 6

/* File WAV trong SPIFFS */
#define AUDIO_TEST_FILE "/spiffs/checkLife.wav"

/* Khoảng nghỉ giữa mỗi lần phát (ms) — để CPU/heap không bị stress */
#define PLAY_INTERVAL_MS 500

/* Khoảng log định kỳ (ms) */
#define LOG_INTERVAL_MS  60000

#define LUMO_FW_VERSION_STRING  "v0.5.6-audio-test"
#define LUMO_FW_BUILD_DATE      __DATE__
#define LUMO_FW_BUILD_TIME      __TIME__

static void print_firmware_version(void)
{
    const esp_app_desc_t *app_desc = esp_app_get_description();

    ESP_LOGI(TAG, "=========================================================");
    ESP_LOGI(TAG, "  LUMO AUDIO TEST FIRMWARE");
    ESP_LOGI(TAG, "---------------------------------------------------------");
    ESP_LOGI(TAG, "  App name      : %s", app_desc->project_name);
    ESP_LOGI(TAG, "  App version   : %s", app_desc->version);
    ESP_LOGI(TAG, "  IDF version   : %s", app_desc->idf_ver);
    ESP_LOGI(TAG, "  Compile time  : %s %s", app_desc->date, app_desc->time);
    ESP_LOGI(TAG, "  ELF SHA256    : %s...", app_desc->app_elf_sha256);
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "  >>> LUMO FW VERSION: %s <<<", LUMO_FW_VERSION_STRING);
    ESP_LOGI(TAG, "  >>> BUILD DATE/TIME: %s %s <<<",
             LUMO_FW_BUILD_DATE, LUMO_FW_BUILD_TIME);
    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "  TEST FILE: %s", AUDIO_TEST_FILE);
    ESP_LOGI(TAG, "  TEST MODE: loop forever");
    ESP_LOGI(TAG, "  I2S PINS: BCLK=%d LRCK=%d DOUT=%d",
             AUDIO_BCLK_GPIO, AUDIO_LRCK_GPIO, AUDIO_DATA_GPIO);
    ESP_LOGI(TAG, "=========================================================");
}

/* SPIFFS init — chỉ cần thiết để firmware có thể đọc file wav */
static esp_err_t spiffs_init(void)
{
    ESP_LOGI(TAG, "Mounting SPIFFS...");
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = "storage",
        .max_files = 5,
        .format_if_mount_failed = true,
    };
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to mount SPIFFS: %s", esp_err_to_name(ret));
        return ret;
    }

    size_t total = 0, used = 0;
    ret = esp_spiffs_info(conf.partition_label, &total, &used);
    if (ret == ESP_OK)
    {
        ESP_LOGI(TAG, "SPIFFS total=%u, used=%u", (unsigned)total, (unsigned)used);
    }

    /* Liệt kê file để verify checkLife.wav tồn tại */
    DIR *dir = opendir("/spiffs");
    if (dir != NULL)
    {
        ESP_LOGI(TAG, "Files in /spiffs:");
        struct dirent *entry;
        while ((entry = readdir(dir)) != NULL)
        {
            if (strcmp(entry->d_name, ".") != 0 && strcmp(entry->d_name, "..") != 0)
            {
                ESP_LOGI(TAG, "  - %s", entry->d_name);
            }
        }
        closedir(dir);
    }
    else
    {
        ESP_LOGW(TAG, "Cannot open /spiffs directory");
    }

    return ESP_OK;
}

void app_main(void)
{
    print_firmware_version();

    /* NVS init — không cần cho test loa nhưng để boot không warning */
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_LOGW(TAG, "NVS needs erase, doing nvs_flash_erase()");
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    /* Mount SPIFFS */
    err = spiffs_init();
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "SPIFFS init failed — cannot play audio");
        ESP_LOGE(TAG, "Rebooting in 5s...");
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_restart();
    }

    /* Verify file tồn tại */
    FILE *test = fopen(AUDIO_TEST_FILE, "rb");
    if (test == NULL)
    {
        ESP_LOGE(TAG, "Cannot find %s", AUDIO_TEST_FILE);
        ESP_LOGE(TAG, "Make sure SPIFFS partition has checkLife.wav");
        ESP_LOGE(TAG, "Rebooting in 5s...");
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_restart();
    }
    fseek(test, 0, SEEK_END);
    long file_size = ftell(test);
    fclose(test);
    ESP_LOGI(TAG, "Found %s (%ld bytes)", AUDIO_TEST_FILE, file_size);

    /* Khởi tạo I2S audio driver */
    ESP_LOGI(TAG, "Initializing I2S audio driver...");
    err = audio_init(AUDIO_BCLK_GPIO, AUDIO_LRCK_GPIO, AUDIO_DATA_GPIO);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "audio_init failed: %s", esp_err_to_name(err));
        ESP_LOGE(TAG, "Check I2S wiring: BCLK=%d LRCK=%d DOUT=%d",
                 AUDIO_BCLK_GPIO, AUDIO_LRCK_GPIO, AUDIO_DATA_GPIO);
        ESP_LOGE(TAG, "Rebooting in 5s...");
        vTaskDelay(pdMS_TO_TICKS(5000));
        esp_restart();
    }
    ESP_LOGI(TAG, "Audio init OK");

    ESP_LOGI(TAG, "");
    ESP_LOGI(TAG, "╔════════════════════════════════════════════════════╗");
    ESP_LOGI(TAG, "║   🔊 LOOP PLAY MODE STARTED                       ║");
    ESP_LOGI(TAG, "║   File: %-40s ║", AUDIO_TEST_FILE);
    ESP_LOGI(TAG, "║   Press RESET to stop                              ║");
    ESP_LOGI(TAG, "╚════════════════════════════════════════════════════╝");
    ESP_LOGI(TAG, "");

    uint32_t play_count = 0;
    uint64_t start_us = esp_timer_get_time();
    uint32_t last_log_ms = 0;
    uint32_t last_play_fail_ms = 0;

    while (1)
    {
        uint32_t now_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
        uint64_t uptime_ms = esp_timer_get_time() / 1000ULL;

        /* Play audio */
        play_count++;
        ESP_LOGI(TAG, "[play #%u @ %llus] Playing %s ...",
                 (unsigned)play_count,
                 (unsigned long long)(uptime_ms / 1000ULL),
                 AUDIO_TEST_FILE);

        uint64_t play_start_ms = esp_timer_get_time() / 1000ULL;
        err = audio_play(AUDIO_TEST_FILE);
        uint64_t play_duration_ms = (esp_timer_get_time() / 1000ULL) - play_start_ms;

        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "audio_play failed (count=%u): %s",
                     (unsigned)play_count, esp_err_to_name(err));
            /* Tránh spam log khi lỗi liên tục */
            if (now_ms - last_play_fail_ms > 5000)
            {
                last_play_fail_ms = now_ms;
            }
        }
        else
        {
            ESP_LOGI(TAG, "[play #%u] Done in %llu ms",
                     (unsigned)play_count,
                     (unsigned long long)play_duration_ms);
        }

        /* Log định kỳ mỗi 60s — uptime + heap + count */
        if (now_ms - last_log_ms > LOG_INTERVAL_MS)
        {
            last_log_ms = now_ms;

            uint32_t free_heap = (uint32_t)heap_caps_get_free_size(MALLOC_CAP_8BIT);
            uint32_t min_free_heap = (uint32_t)heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT);

            ESP_LOGI(TAG, "");
            ESP_LOGI(TAG, "╔════════════════════ STATUS ════════════════════╗");
            ESP_LOGI(TAG, "║  Uptime    : %-6llu s                          ║",
                     (unsigned long long)(uptime_ms / 1000ULL));
            ESP_LOGI(TAG, "║  Play count: %-6u                               ║",
                     (unsigned)play_count);
            ESP_LOGI(TAG, "║  Free heap : %-6u bytes                        ║", (unsigned)free_heap);
            ESP_LOGI(TAG, "║  Min heap  : %-6u bytes                        ║", (unsigned)min_free_heap);
            ESP_LOGI(TAG, "║  Avg interval: %.2f s/play                     ║",
                     (double)(uptime_ms / 1000.0) / (double)play_count);
            ESP_LOGI(TAG, "╚════════════════════════════════════════════════╝");
            ESP_LOGI(TAG, "");
        }

        /* Nghỉ giữa các lần phát */
        vTaskDelay(pdMS_TO_TICKS(PLAY_INTERVAL_MS));
    }
}
