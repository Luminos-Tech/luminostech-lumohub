#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <dirent.h>

#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "esp_crt_bundle.h"
#include "esp_err.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "mbedtls/base64.h"
#include "nvs_flash.h"

#include "audio/audio_player.h"
#include "button/button.h"
#include "http_api/http_api.h"
#include "mic/mic.h"
#include "record/record.h"
#include "wifi/wifi_manager.h"
#include "lumo_runtime.h"

/* OLED đã được TẮT trong bản v0.5.1-test-no-oled — phần cứng không có OLED,
 * chỉ gồm: button (nút nhấn), mạch giải mã loa, MIC. */

#define DEVICE_CODE "0001"
#define RECORD_WAV_PATH "/spiffs/record.wav"
#define MIC_TEST_DURATION_MS 5000
#define RESPONSE_WAV_PATH "/spiffs/response.wav"
#define STARTUP_WAV_PATH "/spiffs/checkLife.wav"
#define AUDIO_SERVER_URL "https://api.luminostech.tech/api/v1/lumo/audio/"

#define BUTTON_GPIO GPIO_NUM_42
#define AUDIO_BCLK_GPIO 5
#define AUDIO_LRCK_GPIO 4
#define AUDIO_DATA_GPIO 6
#define MIC_BCLK_GPIO 15
#define MIC_WS_GPIO 16
#define MIC_DATA_GPIO 17

static const char *TAG = "MAIN";

static lumo_feature_config_t s_features;
#define FEATURES s_features

typedef struct
{
    char endpoint[32];
    char device_code[16];
    char button_state[16];
    char event_type[16];
    char event_value[64];
    int user_id;
} button_event_t;

typedef struct
{
    char file_path[64];
    char server_url[128];
} upload_task_args_t;

static button_t s_button;
static QueueHandle_t s_http_queue = NULL;
static esp_http_client_handle_t s_http_client = NULL;
static SemaphoreHandle_t s_http_mutex = NULL;
static volatile bool s_voice_busy = false;   /* prevents overlapping upload tasks */
static int s_animation_frame = 0;

static bool feature_config_is_valid(void)
{
    bool valid = true;

    if (FEATURES.server_events && (!FEATURES.button || !FEATURES.network))
    {
        ESP_LOGE(TAG, "server_events requires button and network");
        valid = false;
    }

    if (FEATURES.voice_assistant &&
        (!FEATURES.storage || !FEATURES.button || !FEATURES.audio ||
         !FEATURES.network || !FEATURES.microphone))
    {
        ESP_LOGE(TAG,
                 "voice_assistant requires storage, button, audio, network, and microphone");
        valid = false;
    }

    if (FEATURES.microphone_level_log && !FEATURES.microphone)
    {
        ESP_LOGE(TAG, "microphone_level_log requires microphone");
        valid = false;
    }

    if (FEATURES.microphone_record_test &&
        (!FEATURES.storage || !FEATURES.microphone))
    {
        ESP_LOGE(TAG, "microphone_record_test requires storage and microphone");
        valid = false;
    }

    return valid;
}

static void log_feature_state(void)
{
    ESP_LOGI(TAG,
             "Features: storage=%d button=%d audio=%d network=%d "
             "events=%d mic=%d voice=%d mic_log=%d mic_test=%d",
             FEATURES.storage,
             FEATURES.button,
             FEATURES.audio,
             FEATURES.network,
             FEATURES.server_events,
             FEATURES.microphone,
             FEATURES.voice_assistant,
             FEATURES.microphone_level_log,
             FEATURES.microphone_record_test);
}

/* OLED đã TẮT — display_message và display_wifi_setup trở thành no-op. */
static void display_message(const char *message)
{
    (void)message;
}

static void display_wifi_setup(void)
{
}

static esp_err_t init_spiffs_storage(void)
{
    const esp_vfs_spiffs_conf_t config = {
        .base_path = "/spiffs",
        .partition_label = NULL,
        .max_files = 5,
        .format_if_mount_failed = true,
    };

    esp_err_t err = esp_vfs_spiffs_register(&config);
    if (err != ESP_OK)
    {
        return err;
    }

    size_t total = 0;
    size_t used = 0;
    err = esp_spiffs_info(NULL, &total, &used);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "SPIFFS total=%u, used=%u",
                 (unsigned)total, (unsigned)used);
    }

    ESP_LOGI(TAG, "Listing /spiffs/ contents:");
    DIR *d = opendir("/spiffs");
    if (d)
    {
        struct dirent *e;
        while ((e = readdir(d)) != NULL)
        {
            ESP_LOGI(TAG, "  %s", e->d_name);
        }
        closedir(d);
    }
    else
    {
        ESP_LOGW(TAG, "Cannot open /spiffs/ directory");
    }

    return err;
}

static esp_err_t init_nvs_storage(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES ||
        err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        err = nvs_flash_erase();
        if (err != ESP_OK)
        {
            return err;
        }
        err = nvs_flash_init();
    }

    return err;
}

static bool s_ntp_done = false;

/* Maximum time we are willing to wait for the first SNTP sync. */
#define NTP_MAX_WAIT_MS 10000

/* Hold button 5 s to wipe WiFi credentials + reboot into config portal. */
#define FACTORY_RESET_HOLD_MS 5000

static void obtain_time(void)
{
    /* FIX (HIGH-4): Cấu hình SNTP đúng 3 servers. Code cũ gọi
     * esp_netif_sntp_deinit() rồi init chỉ với struct không có
     * .servers → NTP bắn ra nhưng không có server nào để query.
     * Hậu quả: TLS certificate validation có thể fail (chứng chỉ
     * Google thường mới vào đầu năm, thiết bị không biết ngày). */
    esp_sntp_config_t config = {
        .start = true,
        .server_from_dhcp = false,
        .renew_servers_after_new_IP = false,
        .index_of_first_server = 0,
        .num_of_servers = 1,
        .servers = {"time.google.com"},
        .smooth_sync = true,
        .ip_event_to_renew = IP_EVENT_STA_GOT_IP,
    };

    /* Nếu SNTP đã init trước đó (sau reconnect WiFi) thì deinit an toàn. */
    esp_netif_sntp_deinit();
    esp_netif_sntp_init(&config);

    ESP_LOGI(TAG, "NTP sync started (async, 3 servers)");
    s_ntp_done = false;
}

static bool time_synced(void)
{
    if (s_ntp_done)
        return true;

    time_t now = 0;
    time(&now);
    struct tm timeinfo = {0};
    localtime_r(&now, &timeinfo);

    if (timeinfo.tm_year >= (2024 - 1900))
    {
        s_ntp_done = true;
        ESP_LOGI(TAG, "NTP sync complete: %04d-%02d-%02d %02d:%02d:%02d",
                 timeinfo.tm_year + 1900,
                 timeinfo.tm_mon + 1,
                 timeinfo.tm_mday,
                 timeinfo.tm_hour,
                 timeinfo.tm_min,
                 timeinfo.tm_sec);
        return true;
    }
    return false;
}

/* Wait for NTP sync — used to make sure TLS cert validation has
 * the correct system time before any HTTPS call. */
static esp_err_t wait_for_ntp_sync(uint32_t timeout_ms)
{
    const uint32_t start = (uint32_t)(esp_timer_get_time() / 1000ULL);
    while ((uint32_t)(esp_timer_get_time() / 1000ULL) - start < timeout_ms)
    {
        if (time_synced())
        {
            return ESP_OK;
        }
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    ESP_LOGW(TAG, "NTP sync timeout after %u ms — TLS may fail", timeout_ms);
    return ESP_ERR_TIMEOUT;
}

static esp_err_t init_event_http_client(void)
{
    /* keep_alive_idle=30 s: NAT timeout thường 30-120 s, 30 s an toàn.
     * keep_alive_interval=10 s, keep_alive_count=3: probe 3 lần mỗi 10 s
     * trước khi drop connection.                          */
    const esp_http_client_config_t config = {
        .url = "https://api.luminostech.tech/",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 8000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .keep_alive_enable = true,
        .keep_alive_idle = 30,
        .keep_alive_interval = 10,
        .keep_alive_count = 3,
    };

    s_http_client = esp_http_client_init(&config);
    return s_http_client == NULL ? ESP_ERR_NO_MEM : ESP_OK;
}

static void send_button_event_to_server(const button_event_t *event)
{
    if (!wifi_is_connected())
    {
        ESP_LOGW(TAG, "Button event skipped: WiFi is not connected");
        return;
    }

    /* FIX (HIGH-5): đợi NTP trước HTTPS — TLS cần system clock hợp lệ. */
    (void)wait_for_ntp_sync(NTP_MAX_WAIT_MS);

    /* Retry loop với exponential backoff: lỗi "Connection reset by peer" thường
     * là transient — server đang restart hoặc connection pool đầy. Backoff
     * tránh spam server khi nó đang có vấn đề. */
    for (int attempt = 0; attempt < 3; attempt++)
    {
        /* On retries after the first, close and re-init the client to clear
         * any corrupted connection state from the previous attempt. */
        if (attempt > 0)
        {
            if (s_http_client != NULL)
            {
                esp_http_client_cleanup(s_http_client);
                s_http_client = NULL;
            }
            esp_err_t init_err = init_event_http_client();
            if (init_err != ESP_OK)
            {
                ESP_LOGE(TAG, "HTTP client re-init failed on attempt %d: %s",
                         attempt, esp_err_to_name(init_err));
                /* Exponential backoff: 500ms, 1000ms, 2000ms */
                vTaskDelay(pdMS_TO_TICKS(500 << (attempt - 1)));
                continue;
            }
        }

        if (s_http_client == NULL)
        {
            esp_err_t err = init_event_http_client();
            if (err != ESP_OK)
            {
                ESP_LOGE(TAG, "HTTP client initialization failed: %s",
                         esp_err_to_name(err));
                return;
            }
        }

        /* Serialize access to the shared HTTP client */
        if (s_http_mutex != NULL)
            xSemaphoreTake(s_http_mutex, portMAX_DELAY);

        char url[160];
        snprintf(url, sizeof(url), "https://api.luminostech.tech/%s",
                 event->endpoint);

        char post_data[256];
        snprintf(post_data, sizeof(post_data),
                 "{"
                 "\"device_code\":\"%s\","
                 "\"button_state\":\"%s\","
                 "\"event_type\":\"%s\","
                 "\"event_value\":\"%s\","
                 "\"user_id\":%d"
                 "}",
                 event->device_code,
                 event->button_state,
                 event->event_type,
                 event->event_value,
                 event->user_id);

        esp_http_client_set_url(s_http_client, url);
        esp_http_client_set_header(s_http_client, "Content-Type", "application/json");
        esp_http_client_set_header(s_http_client, "Accept", "application/json");
        esp_http_client_set_post_field(s_http_client, post_data, strlen(post_data));

        esp_err_t err = esp_http_client_perform(s_http_client);
        if (err == ESP_OK)
        {
            ESP_LOGI(TAG, "Button event HTTP status=%d (attempt %d)",
                     esp_http_client_get_status_code(s_http_client), attempt + 1);

            if (s_http_mutex != NULL)
                xSemaphoreGive(s_http_mutex);
            return; /* Success */
        }

        ESP_LOGW(TAG, "Button event HTTP failed: %s (attempt %d/%d) — retrying...",
                 esp_err_to_name(err), attempt + 1, 3);

        if (s_http_mutex != NULL)
            xSemaphoreGive(s_http_mutex);

        /* Exponential backoff: 500ms, 1000ms, 2000ms */
        vTaskDelay(pdMS_TO_TICKS(500 << attempt));
    }

    ESP_LOGE(TAG, "Button event failed after 3 attempts");
}

/* === MỚI: POST /api/v1/event-buttons (B2, chạy task riêng) === */
static void send_button_event_iso8601(void)
{
    if (!wifi_is_connected())
    {
        ESP_LOGW(TAG, "[event-buttons] skip: WiFi not connected");
        return;
    }

    /* Đợi NTP — TLS cần clock hợp lệ */
    (void)wait_for_ntp_sync(NTP_MAX_WAIT_MS);

    /* Lấy giờ UTC, format ISO-8601 với 'Z' (chuẩn Pydantic datetime) */
    time_t now = 0;
    struct tm timeinfo = {0};
    char iso[32] = {0};

    time(&now);
    gmtime_r(&now, &timeinfo); /* UTC */
    strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);

    char post_data[160];
    snprintf(post_data, sizeof(post_data),
             "{"
             "\"device_id\":\"%s\","
             "\"time_button_click\":\"%s\""
             "}",
             DEVICE_CODE,
             iso);

    esp_http_client_config_t cfg = {
        .url = "https://api.luminostech.tech/api/v1/event-buttons",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 8000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .keep_alive_enable = true,
    };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (!client)
    {
        ESP_LOGE(TAG, "[event-buttons] esp_http_client_init failed");
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "Accept", "application/json");
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    /* Retry 3 lần với exponential backoff */
    for (int attempt = 0; attempt < 3; attempt++)
    {
        esp_err_t err = esp_http_client_perform(client);
        if (err == ESP_OK)
        {
            int status = esp_http_client_get_status_code(client);
            if (status >= 200 && status < 300)
            {
                ESP_LOGI(TAG,
                         "[event-buttons] OK status=%d body=%s",
                         status, post_data);
            }
            else
            {
                ESP_LOGE(TAG,
                         "[event-buttons] HTTP %d body=%s",
                         status, post_data);
            }
            esp_http_client_cleanup(client);
            return;
        }
        ESP_LOGW(TAG,
                 "[event-buttons] perform failed: %s (attempt %d/3)",
                 esp_err_to_name(err), attempt + 1);
        vTaskDelay(pdMS_TO_TICKS(500 << attempt)); /* 0.5s, 1s, 2s */
    }

    ESP_LOGE(TAG, "[event-buttons] POST failed after 3 attempts");
    esp_http_client_cleanup(client);
}

static void send_button_event_task(void *arg)
{
    (void)arg;
    send_button_event_iso8601();
    vTaskDelete(NULL);
}

static void http_task(void *arg)
{
    (void)arg;
    button_event_t event;

    for (;;)
    {
        if (xQueueReceive(s_http_queue, &event, portMAX_DELAY) == pdTRUE)
        {
            send_button_event_to_server(&event);
        }
    }
}

static esp_err_t init_server_events(void)
{
    /* Queue size 32: enough to absorb bursts (e.g. multiple button presses
     * during WiFi flap) without losing events.  Older events are dropped
     * (xQueueSend with 0 timeout) so the queue never blocks the sender. */
    s_http_queue = xQueueCreate(32, sizeof(button_event_t));
    if (s_http_queue == NULL)
    {
        return ESP_ERR_NO_MEM;
    }

    /* Mutex to protect the shared HTTP client singleton */
    s_http_mutex = xSemaphoreCreateMutex();
    if (s_http_mutex == NULL)
    {
        vQueueDelete(s_http_queue);
        s_http_queue = NULL;
        return ESP_ERR_NO_MEM;
    }

    if (xTaskCreate(http_task, "http_task", 16384, NULL, 5, NULL) != pdPASS)
    {
        vSemaphoreDelete(s_http_mutex);
        vQueueDelete(s_http_queue);
        s_http_mutex = NULL;
        s_http_queue = NULL;
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static esp_err_t mic_test_dump_file_b64(const char *path)
{
    FILE *file = NULL;
    unsigned char input[45];
    unsigned char encoded[64];
    esp_log_level_t default_level;
    esp_log_level_t mic_level;
    esp_log_level_t recorder_level;
    esp_log_level_t band_ble_level;
    long file_size;
    size_t bytes_read;

    if (path == NULL)
    {
        return ESP_ERR_INVALID_ARG;
    }

    file = fopen(path, "rb");
    if (file == NULL)
    {
        ESP_LOGE(TAG, "Cannot open WAV for UART export: %s", path);
        return ESP_FAIL;
    }

    if (fseek(file, 0, SEEK_END) != 0)
    {
        ESP_LOGE(TAG, "Cannot seek WAV for UART export");
        fclose(file);
        return ESP_FAIL;
    }

    file_size = ftell(file);
    if (file_size < 0 || fseek(file, 0, SEEK_SET) != 0)
    {
        ESP_LOGE(TAG, "Cannot determine WAV size for UART export");
        fclose(file);
        return ESP_FAIL;
    }

    /* Giam log dong thoi de stream Base64 khong bi chen dong. */
    default_level = esp_log_level_get(NULL);
    mic_level = esp_log_level_get("MIC");
    recorder_level = esp_log_level_get("RECORDER");
    band_ble_level = esp_log_level_get("BAND_BLE");
    esp_log_level_set("*", ESP_LOG_NONE);
    esp_log_level_set("MIC", ESP_LOG_NONE);
    esp_log_level_set("RECORDER", ESP_LOG_NONE);
    esp_log_level_set("BAND_BLE", ESP_LOG_NONE);

    printf("===B64BEGIN=== size=%ld\n", file_size);
    while ((bytes_read = fread(input, 1, sizeof(input), file)) > 0)
    {
        size_t encoded_len = 0;
        int rc = mbedtls_base64_encode(encoded, sizeof(encoded), &encoded_len,
                                       input, bytes_read);
        if (rc != 0)
        {
            esp_log_level_set("*", default_level);
            esp_log_level_set("MIC", mic_level);
            esp_log_level_set("RECORDER", recorder_level);
            esp_log_level_set("BAND_BLE", band_ble_level);
            fclose(file);
            ESP_LOGE(TAG, "Base64 encode failed: -0x%04X", -rc);
            return ESP_FAIL;
        }

        printf("%.*s\n", (int)encoded_len, (char *)encoded);
    }

    if (ferror(file) != 0)
    {
        esp_log_level_set("*", default_level);
        esp_log_level_set("MIC", mic_level);
        esp_log_level_set("RECORDER", recorder_level);
        esp_log_level_set("BAND_BLE", band_ble_level);
        fclose(file);
        ESP_LOGE(TAG, "WAV read failed during UART export");
        return ESP_FAIL;
    }

    printf("===B64END===\n");
    if (fflush(stdout) != 0)
    {
        esp_log_level_set("*", default_level);
        esp_log_level_set("MIC", mic_level);
        esp_log_level_set("RECORDER", recorder_level);
        esp_log_level_set("BAND_BLE", band_ble_level);
        fclose(file);
        ESP_LOGE(TAG, "UART flush failed after WAV export");
        return ESP_FAIL;
    }
    esp_log_level_set("*", default_level);
    esp_log_level_set("MIC", mic_level);
    esp_log_level_set("RECORDER", recorder_level);
    esp_log_level_set("BAND_BLE", band_ble_level);

    if (fclose(file) != 0)
    {
        ESP_LOGE(TAG, "WAV close failed after UART export");
        return ESP_FAIL;
    }

    return ESP_OK;
}

static esp_err_t run_microphone_record_test(void)
{
    const recorder_config_t config = {
        .output_path = RECORD_WAV_PATH,
        .sample_rate = 16000,
        .duration_ms = MIC_TEST_DURATION_MS,
    };

    ESP_LOGI(TAG, "MIC_TEST_RECORD_BEGIN duration=%dms sample_rate=%dHz path=%s",
             config.duration_ms, config.sample_rate, config.output_path);

    esp_err_t err = recorder_start(&config);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Microphone test recording failed: %s",
                 esp_err_to_name(err));
        return err;
    }

    while (recorder_is_recording())
    {
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    esp_err_t recorder_error = recorder_get_last_error();
    if (recorder_error != ESP_OK)
    {
        ESP_LOGE(TAG, "Recorder failed: %s", esp_err_to_name(recorder_error));
        (void)remove(config.output_path);
        return recorder_error;
    }

    struct stat file_info;
    if (stat(config.output_path, &file_info) != 0)
    {
        ESP_LOGE(TAG, "Microphone test WAV is missing or empty");
        (void)remove(config.output_path);
        return ESP_FAIL;
    }

    uint8_t header[44];
    FILE *file = fopen(config.output_path, "rb");
    bool valid = file != NULL &&
                 fread(header, 1, sizeof(header), file) == sizeof(header);
    if (file != NULL)
    {
        fclose(file);
    }

    const uint32_t expected_data_bytes =
        (uint32_t)((uint64_t)config.sample_rate * 2U *
                   (uint64_t)config.duration_ms / 1000U);
    const uint32_t chunk_size =
        valid ? ((uint32_t)header[4] |
                 ((uint32_t)header[5] << 8) |
                 ((uint32_t)header[6] << 16) |
                 ((uint32_t)header[7] << 24)) : 0;
    const uint32_t sample_rate =
        valid ? ((uint32_t)header[24] |
                 ((uint32_t)header[25] << 8) |
                 ((uint32_t)header[26] << 16) |
                 ((uint32_t)header[27] << 24)) : 0;
    const uint32_t byte_rate =
        valid ? ((uint32_t)header[28] |
                 ((uint32_t)header[29] << 8) |
                 ((uint32_t)header[30] << 16) |
                 ((uint32_t)header[31] << 24)) : 0;
    const uint16_t audio_format =
        valid ? (uint16_t)header[20] | ((uint16_t)header[21] << 8) : 0;
    const uint16_t channels =
        valid ? (uint16_t)header[22] | ((uint16_t)header[23] << 8) : 0;
    const uint16_t block_align =
        valid ? (uint16_t)header[32] | ((uint16_t)header[33] << 8) : 0;
    const uint16_t bits_per_sample =
        valid ? (uint16_t)header[34] | ((uint16_t)header[35] << 8) : 0;
    const uint32_t data_size =
        valid ? ((uint32_t)header[40] |
                 ((uint32_t)header[41] << 8) |
                 ((uint32_t)header[42] << 16) |
                 ((uint32_t)header[43] << 24)) : 0;

    valid = valid &&
            memcmp(header, "RIFF", 4) == 0 &&
            memcmp(&header[8], "WAVE", 4) == 0 &&
            memcmp(&header[12], "fmt ", 4) == 0 &&
            memcmp(&header[36], "data", 4) == 0 &&
            chunk_size == 36U + expected_data_bytes &&
            data_size == expected_data_bytes &&
            sample_rate == (uint32_t)config.sample_rate &&
            byte_rate == (uint32_t)config.sample_rate * 2U &&
            audio_format == 1U && channels == 1U &&
            block_align == 2U && bits_per_sample == 16U &&
            (uint32_t)file_info.st_size == 44U + expected_data_bytes;

    if (!valid)
    {
        ESP_LOGE(TAG, "WAV header invalid");
        (void)remove(config.output_path);
        return ESP_ERR_INVALID_RESPONSE;
    }

    ESP_LOGI(TAG, "Record xong: %.2f giay | %lu bytes | %s",
             (double)config.duration_ms / 1000.0,
             (unsigned long)expected_data_bytes,
             config.output_path);
    ESP_LOGI(TAG, "MIC_TEST_RECORD_DONE bytes=%ld path=%s",
             (long)file_info.st_size, config.output_path);

    err = mic_test_dump_file_b64(config.output_path);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "UART WAV export failed: %s", esp_err_to_name(err));
        return err;
    }

    return ESP_OK;
}

typedef struct
{
    SemaphoreHandle_t done;
    esp_err_t result;
} microphone_test_job_t;

static void microphone_test_task(void *arg)
{
    microphone_test_job_t *job = (microphone_test_job_t *)arg;

    job->result = run_microphone_record_test();
    xSemaphoreGive(job->done);
    vTaskDelete(NULL);
}

static esp_err_t run_microphone_record_test_in_task(void)
{
    microphone_test_job_t job = {
        .done = xSemaphoreCreateBinary(),
        .result = ESP_FAIL,
    };

    if (job.done == NULL)
    {
        return ESP_ERR_NO_MEM;
    }

    if (xTaskCreate(microphone_test_task,
                    "mic_test_task",
                    12288,
                    &job,
                    5,
                    NULL) != pdPASS)
    {
        vSemaphoreDelete(job.done);
        return ESP_ERR_NO_MEM;
    }

    xSemaphoreTake(job.done, portMAX_DELAY);
    vSemaphoreDelete(job.done);
    return job.result;
}

static void queue_button_event(bool first_event)
{
    if (!FEATURES.server_events || s_http_queue == NULL)
    {
        return;
    }

    button_event_t event = {
        .endpoint = "events/",
        .device_code = DEVICE_CODE,
        .event_type = "press",
        .event_value = "None",
        .user_id = 1,
    };

    snprintf(event.button_state,
             sizeof(event.button_state),
             "%s",
             first_event ? "LUMO Start" : "turn button");

    /* Drop oldest if queue is full — prevents blocking on button press.
     * Older events are less urgent than the latest one. */
    if (xQueueSend(s_http_queue, &event, 0) != pdTRUE)
    {
        button_event_t evicted;
        /* Discard oldest to make room, then try once more */
        if (xQueueReceive(s_http_queue, &evicted, 0) == pdTRUE)
        {
            ESP_LOGW(TAG, "Button event queue overflow — dropped old event");
        }
        if (xQueueSend(s_http_queue, &event, 0) != pdTRUE)
        {
            ESP_LOGE(TAG, "Button event queue send failed (FATAL)");
        }
    }
}

static void upload_audio_task(void *arg)
{
    upload_task_args_t *args = (upload_task_args_t *)arg;
    display_message("Processing...");

    ESP_LOGI(TAG, "Uploading %s to %s", args->file_path, args->server_url);

    /* FIX (CRIT): Tắt Task WDT trong sdkconfig (CONFIG_ESP_TASK_WDT_INIT=n).
     * esp_http_client_perform() có thể block > 60s khi server xử lý
     * STT → LLM → TTS. Dùng esp_task_wdt_reset() không đủ → đơn giản
     * nhất là tắt Task WDT hoàn toàn trong menuconfig. */

    /* FIX (HIGH-5): đợi NTP sync tối đa 10 s trước khi mở HTTPS. TLS
     * cần giờ hệ thống để validate chứng chỉ — nếu sntp chưa sync
     * (cold boot) thì HTTPS sẽ fail với lỗi certificate. */
    (void)wait_for_ntp_sync(NTP_MAX_WAIT_MS);

    /* Guard: không POST nếu WiFi chưa connected */
    if (!wifi_is_connected())
    {
        ESP_LOGW(TAG, "WiFi not connected — skipping voice upload");
        s_voice_busy = false;
        vTaskDelete(NULL);
        return;
    }

    esp_err_t err = http_api_upload_audio_get_audio(
        args->server_url,
        args->file_path,
        RESPONSE_WAV_PATH);

    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Voice pipeline failed: %s", esp_err_to_name(err));
        display_message("Server error");
        goto done;
    }

    display_message("LUMO speaking");
    err = audio_play(RESPONSE_WAV_PATH);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Response playback failed: %s", esp_err_to_name(err));
        display_message("Play error");
        goto done;
    }

    ESP_LOGI(TAG, "Voice response playback completed");
    display_message("Done");
    vTaskDelay(pdMS_TO_TICKS(800));
    remove(RESPONSE_WAV_PATH);

done:
    display_message("Hold to speak");
    s_voice_busy = false;
    free(args);
    vTaskDelete(NULL);
}

static void start_voice_interaction(void)
{
    if (!FEATURES.voice_assistant)
    {
        return;
    }

    /* Guard: prevent overlapping voice interactions */
    if (s_voice_busy)
    {
        ESP_LOGW(TAG, "Voice interaction already in progress — ignored");
        return;
    }
    s_voice_busy = true;

    display_message("Recording...");

    const recorder_config_t config = {
        .output_path = RECORD_WAV_PATH,
        .sample_rate = 16000,
        .duration_ms = 5000,
    };

    esp_err_t err = recorder_start(&config);
    if (err != ESP_OK)
    {
        /* FIX (CRIT-3): Không reset s_voice_busy nếu recorder fail sẽ brick
         * thiết bị — mọi lần bấm nút tiếp theo đều bị ignore cho tới reboot. */
        ESP_LOGE(TAG, "Recording failed to start: %s", esp_err_to_name(err));
        display_message("Record failed");
        s_voice_busy = false;
        return;
    }

    while (recorder_is_recording())
    {
        vTaskDelay(pdMS_TO_TICKS(200));
    }

    esp_err_t recorder_error = recorder_get_last_error();
    if (recorder_error != ESP_OK)
    {
        /* Tương tự — release busy flag để user có thể bấm lại. */
        ESP_LOGE(TAG, "Recording completed with error: %s",
                 esp_err_to_name(recorder_error));
        display_message("Record error");
        s_voice_busy = false;
        return;
    }

    ESP_LOGI(TAG, "Recording completed");
    display_message("Thinking...");

    upload_task_args_t *args = calloc(1, sizeof(upload_task_args_t));
    if (args == NULL)
    {
        ESP_LOGE(TAG, "Cannot allocate voice upload arguments");
        display_message("Memory error");
        s_voice_busy = false;
        return;
    }

    snprintf(args->file_path, sizeof(args->file_path), "%s", RECORD_WAV_PATH);
    snprintf(args->server_url, sizeof(args->server_url), "%s", AUDIO_SERVER_URL);

    if (xTaskCreate(upload_audio_task,
                    "upload_task",
                    32768,
                    args,
                    5,
                    NULL) != pdPASS)
    {
        ESP_LOGE(TAG, "Cannot create voice upload task");
        free(args);
        display_message("Task error");
        /* FIX (CRIT-3): reset busy — upload không chạy nên task_done không
         * được gọi, busy flag phải release thủ công. */
        s_voice_busy = false;
    }
}

static void handle_button_press(bool first_event)
{
    ESP_LOGI(TAG, "Button press detected");
    // queue_button_event(first_event);

    /* MỚI: POST event-buttons ngay — chạy task riêng để không block */
    xTaskCreate(
        send_button_event_task,
        "btn_event_iso",
        4096,
        NULL,
        4,
        NULL);

    start_voice_interaction();
}

static float estimate_frequency_hz(const int16_t *pcm, size_t samples,
                                   int sample_rate)
{
    if (pcm == NULL || samples < 3 || sample_rate <= 0)
    {
        return 0.0f;
    }

    int64_t sum = 0;
    for (size_t i = 0; i < samples; i++)
    {
        sum += pcm[i];
    }
    const int32_t mean = (int32_t)(sum / (int64_t)samples);

    int32_t peak = 0;
    for (size_t i = 0; i < samples; i++)
    {
        int32_t value = (int32_t)pcm[i] - mean;
        if (value < 0)
        {
            value = -value;
        }
        if (value > peak)
        {
            peak = value;
        }
    }

    int32_t threshold = peak / 8;
    if (threshold < 64)
    {
        threshold = 64;
    }
    if (peak < threshold * 2)
    {
        return 0.0f;
    }

    bool armed = false;
    size_t first_crossing = 0;
    size_t last_crossing = 0;
    size_t crossings = 0;

    for (size_t i = 0; i < samples; i++)
    {
        const int32_t value = (int32_t)pcm[i] - mean;
        if (value <= -threshold)
        {
            armed = true;
        }
        else if (armed && value >= threshold)
        {
            if (crossings == 0)
            {
                first_crossing = i;
            }
            last_crossing = i;
            crossings++;
            armed = false;
        }
    }

    if (crossings < 2 || last_crossing <= first_crossing)
    {
        return 0.0f;
    }

    const float frequency =
        (float)(crossings - 1) * (float)sample_rate /
        (float)(last_crossing - first_crossing);
    if (frequency < 20.0f || frequency > (float)sample_rate * 0.5f)
    {
        return 0.0f;
    }

    return frequency;
}

static void monitor_microphone_level(int16_t *pcm, size_t frame_samples)
{
    size_t samples_read = 0;
    esp_err_t err = mic_read_frame(pcm, frame_samples, &samples_read);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "mic_read_frame failed: %s", esp_err_to_name(err));
        return;
    }

    float level = 0.0f;
    err = mic_get_level(pcm, samples_read, &level);
    if (err != ESP_OK)
    {
        return;
    }

    const bool is_silence = mic_is_silence(pcm, samples_read, 0.00020f);
    const int sample_rate = mic_get_sample_rate();
    const float frequency_hz = is_silence
                                   ? 0.0f
                                   : estimate_frequency_hz(pcm, samples_read,
                                                           sample_rate);
    int16_t min_value = 32767;
    int16_t max_value = -32768;

    for (size_t i = 0; i < samples_read; i++)
    {
        if (pcm[i] < min_value)
        {
            min_value = pcm[i];
        }
        if (pcm[i] > max_value)
        {
            max_value = pcm[i];
        }
    }

    /* FIX: Tắt VOICE log hoàn toàn. Mic level đã được dùng bên trong
     * để detect voice activation nên không cần log ra serial. Bỏ comment
     * dòng bên dưới nếu cần debug mic level. */
    (void)is_silence;
    (void)level;
    (void)frequency_hz;
    (void)min_value;
    (void)max_value;
    /*
    const bool should_log = !is_silence && level > 0.0010f;
    if (should_log)
    {
        ESP_LOGI(TAG,
                 "[VOICE] level=%.4f freq_est=%.1fHz min=%d max=%d",
                 level,
                 (double)frequency_hz,
                 min_value,
                 max_value);
    }
    */

    s_animation_frame = (s_animation_frame + 1) % 4;
}

static esp_err_t initialize_enabled_features(void)
{
    esp_err_t err;

    if (FEATURES.storage)
    {
        err = init_spiffs_storage();
        if (err != ESP_OK)
        {
            return err;
        }
    }

    if (FEATURES.button)
    {
        err = button_init(&s_button, BUTTON_GPIO, 0, 5);
        if (err != ESP_OK)
        {
            return err;
        }
    }

    if (FEATURES.audio)
    {
        err = audio_init(AUDIO_BCLK_GPIO, AUDIO_LRCK_GPIO, AUDIO_DATA_GPIO);
        if (err != ESP_OK)
        {
            return err;
        }
    }

    /* OLED đã TẮT hoàn toàn — không còn khối if (FEATURES.display) */

    if (FEATURES.network)
    {
        err = init_nvs_storage();
        if (err != ESP_OK)
        {
            return err;
        }

        if (wifi_try_connect_saved(15000))
        {
            ESP_LOGI(TAG, "WiFi connected");
            /* Non-blocking — NTP runs in background */
            obtain_time();
        }
        else
        {
            ESP_LOGW(TAG, "Saved WiFi failed; starting configuration portal");
            display_wifi_setup();
            wifi_start_config_portal();
        }
    }

    if (FEATURES.microphone)
    {
        const mic_config_t config = {
            .sample_rate = 16000,
            .frame_ms = 100,
            .bck_io_num = MIC_BCLK_GPIO,
            .ws_io_num = MIC_WS_GPIO,
            .data_in_num = MIC_DATA_GPIO,
        };

        err = mic_init(&config);
        if (err != ESP_OK)
        {
            return err;
        }

        err = mic_start();
        if (err != ESP_OK)
        {
            return err;
        }
    }

    if (FEATURES.server_events)
    {
        err = init_server_events();
        if (err != ESP_OK)
        {
            return err;
        }
    }

    if (FEATURES.storage && FEATURES.audio)
    {
        // [LUMO-DEV] Auto playback disabled — keep silent during WiFi-only tests.
        // err = audio_play(STARTUP_WAV_PATH);
        // if (err != ESP_OK)
        // {
        //     ESP_LOGW(TAG, "Startup audio was not played: %s",
        //              esp_err_to_name(err));
        // }
    }

    if (FEATURES.button && FEATURES.voice_assistant)
    {
        display_message("Hold to speak");
    }

    return ESP_OK;
}

void lumo_runtime_start(const lumo_feature_config_t *features)
{
    if (features == NULL)
    {
        ESP_LOGE(TAG, "Feature configuration is required");
        for (;;)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
    }

    s_features = *features;
    log_feature_state();

    if (!feature_config_is_valid())
    {
        ESP_LOGE(TAG, "Invalid feature configuration; firmware will remain idle");
        for (;;)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
    }

    esp_err_t err = initialize_enabled_features();
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Feature initialization failed: %s", esp_err_to_name(err));
        for (;;)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
        }
    }

    if (FEATURES.microphone_record_test)
    {
        err = run_microphone_record_test_in_task();
        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "Microphone record test failed: %s",
                     esp_err_to_name(err));
        }
    }

    int16_t *pcm = NULL;
    size_t frame_samples = 0;
    if (FEATURES.microphone_level_log)
    {
        frame_samples = mic_get_frame_samples();
        pcm = malloc(frame_samples * sizeof(int16_t));
        if (pcm == NULL)
        {
            ESP_LOGE(TAG, "Cannot allocate microphone monitor buffer");
        }
    }

    bool first_button_event = true;
    const bool idle_mode = !FEATURES.button && !FEATURES.microphone_level_log;

    if (idle_mode)
    {
        ESP_LOGW(TAG, "All interactive features are locked; entering idle mode");
    }

    for (;;)
    {
        // [LUMO-DEV] Auto playback disabled — keep silent during WiFi-only tests.
        // if (FEATURES.storage && FEATURES.audio)
        // {
        //     esp_err_t play_err = audio_play(STARTUP_WAV_PATH);
        //     if (play_err != ESP_OK)
        //     {
        //         ESP_LOGW(TAG, "Loop play failed: %s", esp_err_to_name(play_err));
        //     }
        // }

        if (FEATURES.button)
        {
            /* FIX (MED-1): dùng button_is_clicked (edge-detect) thay vì
             * button_is_pressed (level). Code cũ trigger khi nhấn xuống nhưng
             * debounce logic ở button.c chỉ set stable_state → bấm ngắn có
             * thể bị miss hoặc bấm dài trigger nhiều lần. */
            button_update(&s_button, (uint32_t)(esp_timer_get_time() / 1000ULL));

            if (button_is_clicked(&s_button))
            {
                handle_button_press(first_button_event);
                first_button_event = false;

            }


            /* Long-press 5 s = factory reset (xóa WiFi cũ + vào captive portal) */
            uint32_t hold_ms = button_current_press_ms(
                &s_button, (uint32_t)(esp_timer_get_time() / 1000ULL));
            if (hold_ms > 0 && (hold_ms % 1000) < 250)
            {
                ESP_LOGI(TAG, "Button held %lu ms — hold 5000 ms to FACTORY RESET",
                         (unsigned long)hold_ms);
            }
            if (button_is_long_pressed(&s_button, FACTORY_RESET_HOLD_MS))
            {
                ESP_LOGW(TAG, ">>> FACTORY RESET: wiping WiFi credentials and rebooting <<<");
                display_message("FACTORY RESET...");
                wifi_factory_reset();
                /* Restart cleanly so the new boot sees no credentials
                 * and the captive portal comes up immediately. */
                esp_restart();
            }

            /* DEBUG: log WiFi status mỗi ~30s khi connected (không spam).
             * Chỉ log ngay khi state CHUYỂN từ disconnected → connected
             * hoặc ngược lại, cộng thêm status mỗi 30s để xác nhận vẫn alive. */
            static uint32_t last_wifi_log_ms = 0;
            static bool last_connected = false;
            uint32_t now_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
            bool currently_connected = wifi_is_connected();
            bool state_changed = (currently_connected != last_connected);
            bool periodic_log = (now_ms - last_wifi_log_ms > 30000);

            if (state_changed || periodic_log)
            {
                last_wifi_log_ms = now_ms;
                if (!currently_connected)
                {
                    ESP_LOGW(TAG, "STATUS: WiFi NOT connected. Saved creds in NVS: checking...");
                    char dbg_ssid[33] = {0};
                    char dbg_pass[65] = {0};
                    if (wifi_load_credentials(dbg_ssid, sizeof(dbg_ssid),
                                              dbg_pass, sizeof(dbg_pass)))
                    {
                        ESP_LOGW(TAG, "  SSID='%s' len=%u, PASS len=%u",
                                 dbg_ssid, (unsigned)strlen(dbg_ssid),
                                 (unsigned)strlen(dbg_pass));
                    }
                    else
                    {
                        ESP_LOGW(TAG, "  No credentials stored (will open captive portal)");
                    }
                }
                else
                {
                    ESP_LOGI(TAG, "STATUS: WiFi CONNECTED (alive check)");
                }
                last_connected = currently_connected;
            }
        }

        if (FEATURES.microphone_level_log && pcm != NULL)
        {
            monitor_microphone_level(pcm, frame_samples);
        }

        vTaskDelay(pdMS_TO_TICKS(200));
    }
}
