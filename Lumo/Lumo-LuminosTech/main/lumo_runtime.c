#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "esp_crt_bundle.h"
#include "esp_err.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "nvs_flash.h"

#include "audio/audio_player.h"
#include "button/button.h"
#include "http_api/http_api.h"
#include "mic/mic.h"
#include "oled/oled.h"
#include "record/record.h"
#include "wifi/wifi_manager.h"
#include "lumo_runtime.h"

#define DEVICE_CODE "001"
#define RECORD_WAV_PATH "/spiffs/record.wav"
#define RESPONSE_WAV_PATH "/spiffs/response.wav"
#define STARTUP_WAV_PATH "/spiffs/LumoHello.wav"
#define AUDIO_SERVER_URL "https://lumohub.luminostech.tech/audio/"

#define BUTTON_GPIO GPIO_NUM_42
#define AUDIO_BCLK_GPIO 5
#define AUDIO_LRCK_GPIO 4
#define AUDIO_DATA_GPIO 6
#define OLED_SDA_GPIO 11
#define OLED_SCL_GPIO 12
#define OLED_I2C_ADDRESS 0x3C
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

    return valid;
}

static void log_feature_state(void)
{
    ESP_LOGI(TAG,
             "Features: storage=%d button=%d audio=%d display=%d network=%d "
             "events=%d mic=%d voice=%d mic_log=%d",
             FEATURES.storage,
             FEATURES.button,
             FEATURES.audio,
             FEATURES.display,
             FEATURES.network,
             FEATURES.server_events,
             FEATURES.microphone,
             FEATURES.voice_assistant,
             FEATURES.microphone_level_log);
}

static void display_message(const char *message)
{
    if (!FEATURES.display)
    {
        return;
    }

    oled_clear();
    oled_draw_text_5x7(10, 33, message, true);
    oled_update();
}

static void display_wifi_setup(void)
{
    if (!FEATURES.display)
    {
        return;
    }

    oled_clear();
    oled_draw_text_5x7(10, 10, "Open: 192.168.4.1", true);
    oled_draw_text_5x7(10, 20, "PASS: 12345678", true);
    oled_draw_text_5x7(10, 30, "WIFI: LUMO SETUP", true);
    oled_draw_text_5x7(20, 40, "Connect WiFi", true);
    oled_draw_text_5x7(30, 50, "LuminosTech", true);
    oled_update();
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

static void obtain_time(void)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("time.google.com");
    config.start = true;
    config.server_from_dhcp = false;

    esp_netif_sntp_deinit();
    esp_netif_sntp_init(&config);

    time_t now = 0;
    struct tm timeinfo = {0};

    for (int retry = 0;
         timeinfo.tm_year < (2024 - 1900) && retry < 15;
         retry++)
    {
        vTaskDelay(pdMS_TO_TICKS(2000));
        time(&now);
        localtime_r(&now, &timeinfo);
    }
}

static esp_err_t init_event_http_client(void)
{
    const esp_http_client_config_t config = {
        .url = "https://lumohub.luminostech.tech/",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .keep_alive_enable = true,
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

    char url[160];
    snprintf(url, sizeof(url), "https://lumohub.luminostech.tech/%s",
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
        ESP_LOGI(TAG, "Button event HTTP status=%d",
                 esp_http_client_get_status_code(s_http_client));
        return;
    }

    ESP_LOGE(TAG, "Button event HTTP request failed: %s",
             esp_err_to_name(err));
    esp_http_client_cleanup(s_http_client);
    s_http_client = NULL;
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
    s_http_queue = xQueueCreate(5, sizeof(button_event_t));
    if (s_http_queue == NULL)
    {
        return ESP_ERR_NO_MEM;
    }

    if (xTaskCreate(http_task, "http_task", 16384, NULL, 5, NULL) != pdPASS)
    {
        vQueueDelete(s_http_queue);
        s_http_queue = NULL;
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
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

    if (xQueueSend(s_http_queue, &event, 0) != pdTRUE)
    {
        ESP_LOGW(TAG, "Button event queue is full");
    }
}

static void upload_audio_task(void *arg)
{
    upload_task_args_t *args = (upload_task_args_t *)arg;
    display_message("Processing...");

    ESP_LOGI(TAG, "Uploading %s to %s", args->file_path, args->server_url);
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
    free(args);
    vTaskDelete(NULL);
}

static void start_voice_interaction(void)
{
    if (!FEATURES.voice_assistant)
    {
        return;
    }

    display_message("Recording...");

    const recorder_config_t config = {
        .output_path = RECORD_WAV_PATH,
        .sample_rate = 16000,
        .duration_ms = 5000,
    };

    esp_err_t err = recorder_start(&config);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Recording failed to start: %s", esp_err_to_name(err));
        display_message("Record failed");
        return;
    }

    while (recorder_is_recording())
    {
        vTaskDelay(pdMS_TO_TICKS(200));
    }

    ESP_LOGI(TAG, "Recording completed");
    display_message("Thinking...");

    upload_task_args_t *args = calloc(1, sizeof(upload_task_args_t));
    if (args == NULL)
    {
        ESP_LOGE(TAG, "Cannot allocate voice upload arguments");
        display_message("Memory error");
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
    }
}

static void handle_button_press(bool first_event)
{
    ESP_LOGI(TAG, "Button press detected");
    queue_button_event(first_event);
    start_voice_interaction();
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

    ESP_LOGI(TAG,
             "[%s] samples=%u level=%.4f min=%d max=%d frame=%d",
             is_silence ? "SILENCE" : "VOICE",
             (unsigned)samples_read,
             level,
             min_value,
             max_value,
             s_animation_frame);

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

    if (FEATURES.display)
    {
        err = oled_begin(OLED_SDA_GPIO, OLED_SCL_GPIO, OLED_I2C_ADDRESS);
        if (err != ESP_OK)
        {
            return err;
        }
        display_message("LUMO starting");
    }

    if (FEATURES.network)
    {
        err = init_nvs_storage();
        if (err != ESP_OK)
        {
            return err;
        }

        display_message("Connecting WiFi");
        if (wifi_try_connect_saved(15000))
        {
            ESP_LOGI(TAG, "WiFi connected");
            display_message("WiFi connected");
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
        err = audio_play(STARTUP_WAV_PATH);
        if (err != ESP_OK)
        {
            ESP_LOGW(TAG, "Startup audio was not played: %s",
                     esp_err_to_name(err));
        }
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

    bool last_button_pressed = false;
    bool first_button_event = true;
    const bool idle_mode = !FEATURES.button && !FEATURES.microphone_level_log;

    if (idle_mode)
    {
        ESP_LOGW(TAG, "All interactive features are locked; entering idle mode");
    }

    for (;;)
    {
        if (FEATURES.button)
        {
            button_update(&s_button, (uint32_t)(esp_timer_get_time() / 1000ULL));
            const bool button_pressed = button_is_pressed(&s_button);

            if (button_pressed && !last_button_pressed)
            {
                handle_button_press(first_button_event);
                first_button_event = false;
            }

            last_button_pressed = button_pressed;
        }

        if (FEATURES.microphone_level_log && pcm != NULL)
        {
            monitor_microphone_level(pcm, frame_samples);
        }

        vTaskDelay(pdMS_TO_TICKS(idle_mode ? 1000 : 10));
    }
}
