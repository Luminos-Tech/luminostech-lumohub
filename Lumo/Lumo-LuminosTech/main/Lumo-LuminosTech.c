#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>

#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_netif_sntp.h"
#include "esp_netif.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "audio/audio_player.h"
#include "oled/oled.h"
#include "button/button.h"
#include "wifi/wifi_manager.h"
#include "wifi/web_portal.h"
#include "http_api/http_api.h"
#include "mic/mic.h"
#include "record/record.h"

// =============================================
// DEFINES & GLOBALS
// =============================================
#define DEVICE_CODE "001"
#define RECORD_WAV_PATH "/spiffs/record.wav"
#define RESPONSE_WAV_PATH "/spiffs/response.wav"
#define AUDIO_SERVER_URL "https://lumohub.luminostech.tech/audio/"

static const char *TAG = "MAIN";
static button_t btn_1;
static esp_http_client_handle_t s_client = NULL;
int animation_frame = 0;

// =============================================
// STRUCT & QUEUE cho HTTP task
// =============================================
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

static QueueHandle_t s_http_queue;

// =============================================
// HTTP CLIENT (event log)
// =============================================
static void init_http_client(void)
{
    esp_http_client_config_t config = {
        .url = "https://lumohub.luminostech.tech/",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .keep_alive_enable = true,
    };
    s_client = esp_http_client_init(&config);
}

static void send_button_event_to_server(
    const char *endpoint,
    const char *device_code,
    const char *button_state,
    const char *event_type,
    const char *event_value,
    int user_id)
{
    if (!wifi_is_connected())
    {
        ESP_LOGW(TAG, "Cannot send event - WiFi not connected");
        return;
    }

    if (s_client == NULL)
    {
        init_http_client();
        if (s_client == NULL)
        {
            ESP_LOGE(TAG, "Failed to init http client");
            return;
        }
    }

    char url[128];
    snprintf(url, sizeof(url), "https://lumohub.luminostech.tech/%s", endpoint);
    esp_http_client_set_url(s_client, url);

    char post_data[256];
    snprintf(post_data, sizeof(post_data),
             "{"
             "\"device_code\": \"%s\","
             "\"button_state\": \"%s\","
             "\"event_type\": \"%s\","
             "\"event_value\": \"%s\","
             "\"user_id\": %d"
             "}",
             device_code, button_state, event_type, event_value, user_id);

    esp_http_client_set_header(s_client, "Content-Type", "application/json");
    esp_http_client_set_header(s_client, "accept", "application/json");
    esp_http_client_set_post_field(s_client, post_data, strlen(post_data));

    esp_err_t err = esp_http_client_perform(s_client);
    if (err == ESP_OK)
    {
        int status_code = esp_http_client_get_status_code(s_client);
        ESP_LOGI(TAG, "HTTP POST Status = %d", status_code);
    }
    else
    {
        ESP_LOGE(TAG, "HTTP POST failed: %s", esp_err_to_name(err));
        esp_http_client_cleanup(s_client);
        s_client = NULL;
    }
}

// =============================================
// HTTP TASK — nhận event từ queue, gửi lên server
// =============================================
static void http_task(void *arg)
{
    button_event_t evt;
    for (;;)
    {
        if (xQueueReceive(s_http_queue, &evt, portMAX_DELAY))
        {
            send_button_event_to_server(
                evt.endpoint,
                evt.device_code,
                evt.button_state,
                evt.event_type,
                evt.event_value,
                evt.user_id);
        }
    }
}

// =============================================
// UPLOAD AUDIO TASK — Full pipeline:
//   ESP32 WAV → Server STT → TTT → TTS → WAV → audio_play
// =============================================
static void upload_audio_task(void *arg)
{
    upload_task_args_t *args = (upload_task_args_t *)arg;

    // ── Hiển thị trạng thái đang xử lý ──────────────────────
    oled_clear();
    oled_draw_text_5x7(10, 63 - 10, "Processing...", true);
    oled_update();

    ESP_LOGI(TAG, "Uploading %s → %s", args->file_path, args->server_url);

    // ── Gọi HTTP: upload WAV, nhận lại WAV phản hồi ──────────
    esp_err_t err = http_api_upload_audio_get_audio(
        args->server_url,
        args->file_path,
        RESPONSE_WAV_PATH);

    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Upload/pipeline failed: %s", esp_err_to_name(err));
        oled_clear();
        oled_draw_text_5x7(10, 63 - 20, "Server error!", true);
        oled_update();
        goto done;
    }

    ESP_LOGI(TAG, "Response WAV saved to %s, starting playback", RESPONSE_WAV_PATH);

    // ── Cập nhật OLED trước khi phát ─────────────────────────
    oled_clear();
    oled_draw_text_5x7(10, 63 - 20, "LUMO speaking...", true);
    oled_update();

    // ── Phát file WAV phản hồi ────────────────────────────────
    err = audio_play(RESPONSE_WAV_PATH);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "audio_play failed: %s", esp_err_to_name(err));
        oled_clear();
        oled_draw_text_5x7(10, 63 - 20, "Play error!", true);
        oled_update();
        goto done;
    }

    ESP_LOGI(TAG, "Playback done");
    oled_clear();
    oled_draw_text_5x7(10, 63 - 20, "Done!", true);
    oled_update();
    vTaskDelay(pdMS_TO_TICKS(800));

    // ── Xoá file tạm để tiết kiệm SPIFFS ─────────────────────
    remove(RESPONSE_WAV_PATH);

done:
    // Về màn hình chờ
    oled_clear();
    oled_draw_text_5x7(10, 63 - 20, "Hold to speak", true);
    oled_update();

    free(args);
    vTaskDelete(NULL);
}

// =============================================
// HELPER FUNCTIONS
// =============================================
static uint32_t millis(void)
{
    return (uint32_t)(esp_timer_get_time() / 1000ULL);
}

static void init_spiffs(void)
{
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = NULL,
        .max_files = 5,
        .format_if_mount_failed = true,
    };
    ESP_ERROR_CHECK(esp_vfs_spiffs_register(&conf));

    size_t total = 0, used = 0;
    ESP_ERROR_CHECK(esp_spiffs_info(NULL, &total, &used));
    ESP_LOGI(TAG, "SPIFFS total=%u, used=%u", (unsigned)total, (unsigned)used);
}

static void obtain_time(void)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("time.google.com");
    config.start = true;
    config.server_from_dhcp = false;

    esp_netif_sntp_deinit();
    esp_netif_sntp_init(&config);

    time_t now = 0;
    struct tm timeinfo = {0};
    int retry = 0;
    const int retry_count = 15;

    while (timeinfo.tm_year < (2024 - 1900) && retry < retry_count)
    {
        vTaskDelay(pdMS_TO_TICKS(2000));
        time(&now);
        localtime_r(&now, &timeinfo);
        retry++;
    }
}

// =============================================
// APP MAIN
// =============================================
void app_main(void)
{
    bool eventOldButton = false;
    bool isButtonEventStartRunning = true;
    esp_err_t ret;

    init_spiffs();

    ESP_ERROR_CHECK(button_init(&btn_1, GPIO_NUM_42, 0, 5));
    ESP_ERROR_CHECK(audio_init(5, 4, 6));

    ESP_LOGI(TAG, "Start OLED...");
    ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));

    oled_clear();
    oled_draw_text_5x7(10, 10, "Open: 192.168.4.1", true);
    oled_draw_text_5x7(10, 20, "PASS: 12345678", true);
    oled_draw_text_5x7(10, 30, "WIFI: LUMO SETUP", true);
    oled_draw_text_5x7(20, 40, "Connect WiFi", true);
    oled_draw_text_5x7(30, 50, "LuminosTech", true);
    oled_update();

    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    }

    bool ok = wifi_try_connect_saved(15000);
    if (ok)
    {
        ESP_LOGI(TAG, "WiFi connected normally");
        obtain_time();

        oled_clear();
        oled_draw_text_5x7(10, 63 - 10, "WiFi connected!", true);
        oled_update();
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    else
    {
        ESP_LOGW(TAG, "Start config portal because WiFi failed");
        wifi_start_config_portal();
    }

    mic_config_t mic_cfg = {
        .sample_rate = 16000,
        .frame_ms = 100,
        .bck_io_num = 15,
        .ws_io_num = 16,
        .data_in_num = 17,
    };

    ESP_ERROR_CHECK(mic_init(&mic_cfg));
    ESP_ERROR_CHECK(mic_start());

    size_t frame_samples = mic_get_frame_samples();
    int16_t *pcm = (int16_t *)malloc(frame_samples * sizeof(int16_t));
    if (pcm == NULL)
    {
        ESP_LOGE(TAG, "Cannot allocate pcm buffer");
        return;
    }

    ESP_LOGI(TAG, "Start reading mic... frame_samples=%u", (unsigned)frame_samples);

    s_http_queue = xQueueCreate(5, sizeof(button_event_t));
    xTaskCreate(http_task, "http_task", 16384, NULL, 5, NULL);

    // Màn hình chờ
    oled_clear();
    oled_draw_text_5x7(10, 63 - 20, "Hold to speak", true);
    oled_update();

    static bool last_pressed = false;
    static bool startup_audio_played = false;

    audio_play("/spiffs/LumoHello.wav");
    while (1)
    {
        // audio_play("/spiffs/LumoHello.wav");
        uint32_t now = millis();
        button_update(&btn_1, now);

        bool current_pressed = button_is_pressed(&btn_1);

        if(button_is_pressed(&btn_1)) ESP_LOGI(TAG, "1");
        else ESP_LOGI(TAG, "0");


        if (current_pressed && !last_pressed)
        {
            ESP_LOGI(TAG, "Button 1 detected");

            if (eventOldButton) {
                ESP_LOGI(TAG, "Button 1 detected");
            }
            else 
            audio_play("/spiffs/LumoHello.wav");

            eventOldButton = true;

            // ── Gửi event lên server qua queue ───────────────
            if (isButtonEventStartRunning)
            {
                button_event_t evt = {
                    .endpoint = "events/",
                    .device_code = DEVICE_CODE,
                    .button_state = "LUMO Start",
                    .event_type = "press",
                    .event_value = "None",
                    .user_id = 1,
                };
                xQueueSend(s_http_queue, &evt, 0);
                isButtonEventStartRunning = false;
            }
            else
            {
                button_event_t evt = {
                    .endpoint = "events/",
                    .device_code = DEVICE_CODE,
                    .button_state = "turn button",
                    .event_type = "press",
                    .event_value = "None",
                    .user_id = 1,
                };
                xQueueSend(s_http_queue, &evt, 0);
            }

            // ── Hiển thị WiFi status + bắt đầu ghi ──────────
            oled_clear();
            oled_draw_text_5x7(110, 63 - 10, wifi_is_connected() ? "on" : "of", true);
            oled_draw_text_5x7(10, 63 - 20, "Recording...", true);
            oled_update();

            // ── Ghi âm ───────────────────────────────────────
            recorder_config_t cfg = {
                .output_path = RECORD_WAV_PATH,
                .sample_rate = 16000,
                .duration_ms = 5000,
            };

            recorder_start(&cfg);

            if (recorder_is_recording())
            {
                ESP_LOGI(TAG, "Recording started...");



                // Chờ ghi xong hoàn toàn
                while (recorder_is_recording())
                {
                    vTaskDelay(pdMS_TO_TICKS(200));
                }

                ESP_LOGI(TAG, "Recording done → uploading for STT+TTT+TTS");

                oled_clear();
                oled_draw_text_5x7(10, 63 - 10, "Thinking...", true);
                oled_update();

                // ── Tạo task riêng (stack 32KB) để upload & play ──
                upload_task_args_t *args = malloc(sizeof(upload_task_args_t));
                if (args != NULL)
                {
                    strncpy(args->file_path, RECORD_WAV_PATH, sizeof(args->file_path) - 1);
                    strncpy(args->server_url, AUDIO_SERVER_URL, sizeof(args->server_url) - 1);

                    xTaskCreate(
                        upload_audio_task,
                        "upload_task",
                        32768,
                        args,
                        5,
                        NULL);
                }
                else
                {
                    ESP_LOGE(TAG, "Cannot allocate upload args");
                    oled_clear();
                    oled_draw_text_5x7(10, 30, "Mem error", true);
                    oled_update();
                }
            }
            else
            {
                ESP_LOGE(TAG, "Failed to start recording");
                oled_clear();
                oled_draw_text_5x7(10, 63 - 10, "Record failed", true);
                oled_update();
            }
        }

        last_pressed = current_pressed;
        vTaskDelay(pdMS_TO_TICKS(10));

        // ── Đọc frame mic để monitor level ───────────────────
        size_t samples_read = 0;
        esp_err_t err = mic_read_frame(pcm, frame_samples, &samples_read);
        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "mic_read_frame failed: %s", esp_err_to_name(err));
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        float level = 0.0f;
        err = mic_get_level(pcm, samples_read, &level);
        if (err != ESP_OK)
        {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        bool is_silence = mic_is_silence(pcm, samples_read, 0.00020f);

        int16_t min_v = 32767;
        int16_t max_v = -32768;
        for (size_t i = 0; i < samples_read; i++)
        {
            if (pcm[i] < min_v)
                min_v = pcm[i];
            if (pcm[i] > max_v)
                max_v = pcm[i];
        }

        ESP_LOGI(TAG,
                 "[%s] samples=%u level=%.4f min=%d max=%d",
                 is_silence ? "SILENCE" : "VOICE",
                 (unsigned)samples_read,
                 level, min_v, max_v);

        animation_frame = (animation_frame + 1) % 4;
    }
}