#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>
#include <errno.h>
#include <stdatomic.h>
#include "esp_spiffs.h"

#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_netif_sntp.h"
#include "esp_netif.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_spiffs.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "esp_heap_caps.h"
#include "esp_crt_bundle.h"
#include "audio/audio_player.h"
#include "audio/audio_stream.h"
#include "oled/oled.h"
#include "button/button.h"
#include "wifi/wifi_manager.h"
#include "wifi/web_portal.h"
#include "http_api/http_api.h"
#include "ws/ws_client.h"
#include "mic/mic.h"
#include "record/record.h"
#include "cJSON.h"

// ─────────────────────────────────────────────────────────────
//  HARDCODE — thay đổi ở đây khi cần
// ─────────────────────────────────────────────────────────────
#define DEVICE_CODE        "0001"
#define WS_URI             "wss://api.luminostech.tech/ws/stream?device_id=0001"
#define EVENT_BUTTONS_URL  "https://api.luminostech.tech/api/v1/event-buttons"

static const char *TAG = "MAIN";

// GPIO cho loa (I2S DAC mode — dùng MAX98357A I2S input)
#define I2S_BCLK_GPIO    5
#define I2S_WS_GPIO      4
#define I2S_DOUT_GPIO    6
#define I2S_SAMPLE_RATE  24000

// GPIO cho micro (I2S slave)
#define MIC_BCLK_GPIO   15
#define MIC_WS_GPIO      16
#define MIC_DIN_GPIO    17

static button_t btn_1;
static atomic_bool s_ws_connected = ATOMIC_VAR_INIT(false);
static atomic_bool s_ws_streaming = ATOMIC_VAR_INIT(false);

// ─────────────────────────────────────────────────────────────
//  WS DONE CALLBACK — gọi từ ws_client khi server gửi done/error
// ─────────────────────────────────────────────────────────────
static void on_ws_done(const char *type, const char *message)
{
    if (message && message[0])
        ESP_LOGI(TAG, "WS done: type=%s msg=%s", type, message);
    else
        ESP_LOGI(TAG, "WS done: type=%s", type);

    if (strcmp(type, "done") == 0)
    {
        vTaskDelay(pdMS_TO_TICKS(1200));  // đợi PCM queue drain hết
        audio_stream_stop();
        atomic_store(&s_ws_streaming, false);
    }
    else if (strcmp(type, "error") == 0)
    {
        audio_stream_stop();
        atomic_store(&s_ws_streaming, false);
        oled_clear();
        oled_draw_text_5x7(10, 63 - 10, "WS error!", true);
        oled_update();
    }
}

// ─────────────────────────────────────────────────────────────
//  GỬI EVENT BUTTON LÊN SERVER (HTTP đơn giản)
// ─────────────────────────────────────────────────────────────
static void send_event_button(const char *device_code)
{
    if (!wifi_is_connected())
    {
        ESP_LOGW(TAG, "Cannot send event - WiFi not connected");
        return;
    }

    time_t now_t = time(NULL);
    struct tm utc;
    gmtime_r(&now_t, &utc);
    char time_buf[32];
    strftime(time_buf, sizeof(time_buf), "%Y-%m-%dT%H:%M:%S.000Z", &utc);

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "device_id", device_code);
    cJSON_AddStringToObject(root, "time_button_click", time_buf);
    char *json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!json_str)
        return;

    int http_status = 0;
    esp_err_t err = http_api_post_json(EVENT_BUTTONS_URL, json_str, &http_status);
    if (err == ESP_OK)
        ESP_LOGI(TAG, "Event sent, HTTP %d", http_status);
    else
        ESP_LOGE(TAG, "Event send failed: %s", esp_err_to_name(err));

    free(json_str);
}

// ─────────────────────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────────────────────
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
    ESP_LOGI(TAG, "SPIFFS total=%u used=%u", (unsigned)total, (unsigned)used);
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

// ─────────────────────────────────────────────────────────────
//  APP MAIN
// ─────────────────────────────────────────────────────────────
void app_main(void)
{
    // ── 1. Init SPIFFS ────────────────────────────────────────
    init_spiffs();

    // ── 2. Init button ────────────────────────────────────────
    ESP_ERROR_CHECK(button_init(&btn_1, GPIO_NUM_42, 1, 5));

    // ── 3. Init I2S DMA audio streaming ─────────────────────
    ESP_LOGI(TAG, "Init audio stream (I2S DMA %d Hz)...", I2S_SAMPLE_RATE);
    esp_err_t ret = audio_stream_init(I2S_BCLK_GPIO, I2S_WS_GPIO, I2S_DOUT_GPIO, I2S_SAMPLE_RATE);
    if (ret != ESP_OK)
        ESP_LOGE(TAG, "audio_stream_init failed: %s", esp_err_to_name(ret));

    ESP_LOGI(TAG, "Init audio player...");
    ESP_ERROR_CHECK(audio_init(I2S_BCLK_GPIO, I2S_WS_GPIO, I2S_DOUT_GPIO));

    // ── 4. Init OLED ─────────────────────────────────────────
    ESP_LOGI(TAG, "Start OLED...");
    ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));

    oled_clear();
    oled_draw_text_5x7(10, 10, "Open: 192.168.4.1", true);
    oled_draw_text_5x7(10, 20, "PASS: 12345678", true);
    oled_draw_text_5x7(10, 30, "WIFI: LUMO SETUP", true);
    oled_draw_text_5x7(20, 40, "Connect WiFi", true);
    oled_draw_text_5x7(30, 50, "LuminosTech", true);
    oled_update();

    // ── 5. Init NVS ───────────────────────────────────────────
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    }

    // ── 6. Kết nối WiFi ──────────────────────────────────────
    bool ok = wifi_try_connect_saved(15000);
    if (ok)
    {
        ESP_LOGI(TAG, "WiFi connected");
        obtain_time();

        oled_clear();
        oled_draw_text_5x7(10, 63 - 10, "WiFi connected!", true);
        oled_update();
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    else
    {
        ESP_LOGW(TAG, "Start config portal");
        wifi_start_config_portal();
    }

    // ── 7. Init micro ─────────────────────────────────────────
    mic_config_t mic_cfg = {
        .sample_rate = 16000,
        .frame_ms = 100,
        .bck_io_num = MIC_BCLK_GPIO,
        .ws_io_num = MIC_WS_GPIO,
        .data_in_num = MIC_DIN_GPIO,
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

    // ── 8. Init WebSocket client & connect ───────────────────
    oled_clear();
    oled_draw_text_5x7(10, 63 - 10, "Connecting WS...", true);
    oled_update();

    ESP_LOGI(TAG, "WS init: %s", WS_URI);
    ret = ws_client_init(WS_URI, on_ws_done);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "ws_client_init failed: %s", esp_err_to_name(ret));
    }
    else
    {
        ret = ws_client_connect();
        if (ret != ESP_OK)
            ESP_LOGE(TAG, "ws_client_connect failed: %s", esp_err_to_name(ret));
    }

    // ── 9. Màn hình chờ ──────────────────────────────────────
    oled_clear();
    oled_draw_text_5x7(10, 63 - 20, "Hold to speak", true);
    oled_update();

    static bool last_pressed = false;
    bool last_ws_connected = false;

    while (1)
    {
        uint32_t now = millis();
        button_update(&btn_1, now);

        bool current_pressed = button_is_pressed(&btn_1);

        // ── Button pressed (falling edge) ─────────────────────
        if (current_pressed && !last_pressed)
        {
            ESP_LOGI(TAG, "Button pressed");

            send_event_button(DEVICE_CODE);

            oled_clear();
            oled_draw_text_5x7(110, 63 - 10, wifi_is_connected() ? "on" : "of", true);
            oled_draw_text_5x7(10, 63 - 20, "Recording...", true);
            oled_update();

            recorder_config_t cfg = {
                .output_path = "/spiffs/record.wav",
                .sample_rate = 16000,
                .duration_ms = 5000,
            };

            ret = recorder_start(&cfg);
            if (ret != ESP_OK)
            {
                ESP_LOGE(TAG, "recorder_start failed: %s", esp_err_to_name(ret));
                oled_clear();
                oled_draw_text_5x7(10, 63 - 10, "Rec error!", true);
                oled_update();
            }

            ESP_LOGI(TAG, "Recording started...");
        }

        // ── Button released (rising edge) ─────────────────────
        if (!current_pressed && last_pressed)
        {
            ESP_LOGI(TAG, "Button released");

            esp_err_t rec_err = recorder_stop();
            if (rec_err != ESP_OK)
                ESP_LOGE(TAG, "recorder_stop failed");

            // ── Kết nối / reconnect WS nếu cần ──────────────
            ws_state_t state = ws_client_state();
            if (state != WS_STATE_CONNECTED)
            {
                ESP_LOGW(TAG, "WS not connected (state=%d), reconnecting...", state);
                ws_client_disconnect();
                esp_err_t reconn = ws_client_init(WS_URI, on_ws_done);
                if (reconn == ESP_OK)
                    ws_client_connect();

                for (int i = 0; i < 30; i++)
                {
                    vTaskDelay(pdMS_TO_TICKS(100));
                    if (ws_client_state() == WS_STATE_CONNECTED)
                        break;
                }
            }

            if (ws_client_state() == WS_STATE_CONNECTED && !atomic_load(&s_ws_streaming))
            {
                ESP_LOGI(TAG, "Sending audio via WS...");
                oled_clear();
                oled_draw_text_5x7(10, 63 - 10, "Thinking...", true);
                oled_update();

                atomic_store(&s_ws_streaming, true);

                esp_err_t send_err = ws_client_send_file("/spiffs/record.wav");
                if (send_err != ESP_OK)
                {
                    ESP_LOGE(TAG, "ws_client_send_file failed: %s", esp_err_to_name(send_err));
                    oled_clear();
                    oled_draw_text_5x7(10, 63 - 10, "Send error!", true);
                    oled_update();
                    atomic_store(&s_ws_streaming, false);
                }
            }
            else
            {
                if (ws_client_state() != WS_STATE_CONNECTED)
                {
                    ESP_LOGE(TAG, "WS still offline, cannot send");
                    oled_clear();
                    oled_draw_text_5x7(10, 63 - 10, "WS offline!", true);
                    oled_update();
                }
            }

            remove("/spiffs/record.wav");
        }

        // ── Theo dõi trạng thái WS ──────────────────────────
        {
            ws_state_t ws_state = ws_client_state();
            bool now_connected = (ws_state == WS_STATE_CONNECTED);

            if (now_connected != last_ws_connected)
            {
                last_ws_connected = now_connected;
                atomic_store(&s_ws_connected, now_connected);

                ESP_LOGI(TAG, "WS state → %s", now_connected ? "CONNECTED" : "DISCONNECTED");
                oled_draw_text_5x7(110, 63 - 10, now_connected ? "ws" : "w-", true);
                oled_update();
            }
        }

        last_pressed = current_pressed;

        // ── Mic monitoring (không làm gì với dữ liệu audio) ──
        size_t samples_read = 0;
        esp_err_t mic_err = mic_read_frame(pcm, frame_samples, &samples_read);
        if (mic_err != ESP_OK || samples_read == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
