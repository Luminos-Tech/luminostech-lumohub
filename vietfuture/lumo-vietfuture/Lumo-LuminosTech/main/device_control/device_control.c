#include "device_control.h"

#include <stdio.h>
#include <string.h>
#include <time.h>
#include "esp_timer.h"
#include "esp_system.h"
#include "sdkconfig.h"
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "esp_websocket_client.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "audio/audio_player.h"
#include "wifi/wifi_manager.h"
#include "ble/lumo_band_central.h"

static const char *TAG = "DEVICE_CONTROL";
static esp_websocket_client_handle_t s_client;
static QueueHandle_t s_commands;
static QueueHandle_t s_logs;
static char s_uri[256];
static char s_device_code[16];
static char s_firmware_version[64];
static volatile uint32_t s_cancel_generation;
static volatile bool s_registration_ready;
static volatile bool s_hello_pending;
static volatile uint32_t s_connected_at_ms;
static volatile uint32_t s_connection_generation;

typedef struct {
    char request_id[33];
    char sound[16];
    uint32_t generation;
} sound_command_t;

typedef struct {
    uint32_t uptime_ms;
    char level;
    char tag[24];
    char message[192];
} device_log_t;

void device_control_log(char level, const char *tag, const char *message)
{
    if (s_logs == NULL || tag == NULL || message == NULL ||
        (level != 'I' && level != 'W' && level != 'E')) return;
    device_log_t entry = {
        .uptime_ms = (uint32_t)(esp_timer_get_time() / 1000ULL),
        .level = level,
    };
    snprintf(entry.tag, sizeof(entry.tag), "%.23s", tag);
    snprintf(entry.message, sizeof(entry.message), "%.191s", message);
    if (xQueueSend(s_logs, &entry, 0) != pdTRUE) {
        device_log_t oldest;
        xQueueReceive(s_logs, &oldest, 0);
        xQueueSend(s_logs, &entry, 0);
    }
}

static bool send_json(cJSON *message)
{
    if (message == NULL) return false;
    char *text = cJSON_PrintUnformatted(message);
    bool sent = false;
    if (text != NULL && esp_websocket_client_is_connected(s_client)) {
        int length = strlen(text);
        sent = esp_websocket_client_send_text(s_client, text, length, pdMS_TO_TICKS(2000)) == length;
    }
    cJSON_free(text);
    cJSON_Delete(message);
    return sent;
}

static bool send_hello(void)
{
    cJSON *hello = cJSON_CreateObject();
    if (hello == NULL) return false;
    cJSON_AddStringToObject(hello, "type", "hello");
    cJSON_AddStringToObject(hello, "device_id", s_device_code);
    cJSON_AddStringToObject(hello, "firmware_version", s_firmware_version);
    cJSON *capabilities = cJSON_AddArrayToObject(hello, "capabilities");
    cJSON_AddItemToArray(capabilities, cJSON_CreateString("audio_control_v1"));
    cJSON_AddItemToArray(capabilities, cJSON_CreateString("device_logs_v1"));
    bool sent = send_json(hello);
    ESP_LOGI(TAG, "Hub %s registration handshake: %s",
             s_device_code, sent ? "sent; waiting for backend confirmation" : "send failed");
    device_control_log(sent ? 'I' : 'W', TAG, sent ? "Registration handshake sent" : "Registration handshake send failed");
    return sent;
}

static void flush_logs(void)
{
    if (!s_registration_ready || s_logs == NULL || uxQueueMessagesWaiting(s_logs) == 0) return;
    cJSON *message = cJSON_CreateObject();
    if (message == NULL) return;
    cJSON_AddStringToObject(message, "type", "device_logs");
    cJSON *entries = cJSON_AddArrayToObject(message, "entries");
    if (entries == NULL) { cJSON_Delete(message); return; }
    device_log_t entry;
    for (int count = 0; count < 5 && xQueueReceive(s_logs, &entry, 0) == pdTRUE; count++) {
        cJSON *item = cJSON_CreateObject();
        if (item == NULL) break;
        char level[2] = {entry.level, '\0'};
        cJSON_AddStringToObject(item, "level", level);
        cJSON_AddStringToObject(item, "tag", entry.tag);
        cJSON_AddStringToObject(item, "message", entry.message);
        cJSON_AddNumberToObject(item, "uptime_ms", entry.uptime_ms);
        cJSON_AddItemToArray(entries, item);
    }
    /* Best-effort, bounded logging must not block or retry user commands. */
    send_json(message);
}

static void send_result(const char *request_id, const char *status)
{
    cJSON *result = cJSON_CreateObject();
    if (result == NULL) return;
    cJSON_AddStringToObject(result, "type", "command_result");
    cJSON_AddStringToObject(result, "request_id", request_id);
    cJSON_AddStringToObject(result, "status", status);
    send_json(result);
    ESP_LOGI(TAG, "Command %s: %s", request_id, status);
    char line[96];
    snprintf(line, sizeof(line), "Command result: %s", status);
    device_control_log(strcmp(status, "error") == 0 ? 'E' :
                       strcmp(status, "busy") == 0 ? 'W' : 'I', TAG, line);
}

static const char *sound_path(const char *sound)
{
    if (strcmp(sound, "beep") == 0) return "/spiffs/beep.wav";
    if (strcmp(sound, "greeting") == 0) return "/spiffs/LumoHello.wav";
    if (strcmp(sound, "checkin") == 0) return "/spiffs/checkLife.wav";
    return NULL;
}

static void handle_message(const char *text)
{
    cJSON *message = cJSON_Parse(text);
    if (message == NULL) return;
    const cJSON *type = cJSON_GetObjectItemCaseSensitive(message, "type");
    if (cJSON_IsString(type) && strcmp(type->valuestring, "ready") == 0) {
        const cJSON *code = cJSON_GetObjectItemCaseSensitive(message, "device_id");
        if (cJSON_IsString(code) && strcmp(code->valuestring, s_device_code) == 0) {
            /* The deployed backend sends ready only after finding an active,
             * registered device row. Such rows already belong to a user. */
            s_registration_ready = true;
            ESP_LOGI(TAG, "Backend recognized Hub %s (registered/active); web audio control is online",
                     s_device_code);
            device_control_log('I', TAG, "Backend accepted registration; Hub is online");
        } else {
            ESP_LOGW(TAG, "Ignored registration response for a different device");
        }
        cJSON_Delete(message);
        return;
    }
    const cJSON *id = cJSON_GetObjectItemCaseSensitive(message, "request_id");
    const cJSON *action = cJSON_GetObjectItemCaseSensitive(message, "action");
    if (!cJSON_IsString(type) || strcmp(type->valuestring, "command") != 0 ||
        !cJSON_IsString(id) || strlen(id->valuestring) != 32 || !cJSON_IsString(action)) {
        cJSON_Delete(message);
        return;
    }
    if (strcmp(action->valuestring, "stop_audio") == 0) {
        device_control_log('I', "AUDIO", "Web requested audio stop");
        s_cancel_generation++;
        audio_stop();
        send_result(id->valuestring, "stopped");
    } else if (strcmp(action->valuestring, "play_sound") == 0) {
        const cJSON *sound = cJSON_GetObjectItemCaseSensitive(message, "sound");
        if (!cJSON_IsString(sound) || sound_path(sound->valuestring) == NULL) {
            send_result(id->valuestring, "error");
        } else {
            sound_command_t command = {0};
            command.generation = s_cancel_generation;
            snprintf(command.request_id, sizeof(command.request_id), "%s", id->valuestring);
            snprintf(command.sound, sizeof(command.sound), "%s", sound->valuestring);
            if (audio_is_playing() || xQueueSend(s_commands, &command, 0) != pdTRUE) {
                send_result(id->valuestring, "busy");
            }
        }
    } else {
        send_result(id->valuestring, "error");
    }
    cJSON_Delete(message);
}

static void websocket_event(void *arg, esp_event_base_t base, int32_t event_id, void *event_data)
{
    (void)arg;
    (void)base;
    static char message[1024];
    static size_t received;
    esp_websocket_event_data_t *data = event_data;
    if (event_id == WEBSOCKET_EVENT_CONNECTED) {
        received = 0;
        s_connection_generation++;
        s_connected_at_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
        s_registration_ready = false;
        s_hello_pending = true;
        ESP_LOGI(TAG, "WebSocket transport connected; registration is pending");
        device_control_log('I', TAG, "WebSocket connected; waiting for registration confirmation");
    } else if (event_id == WEBSOCKET_EVENT_DISCONNECTED || event_id == WEBSOCKET_EVENT_CLOSED) {
        received = 0;
        s_registration_ready = false;
        s_hello_pending = false;
        s_connected_at_ms = 0;
        s_cancel_generation++;
        xQueueReset(s_commands);
        ESP_LOGW(TAG, "Server connection closed; automatic reconnect enabled");
        device_control_log('W', TAG, "WebSocket disconnected; reconnect scheduled");
    } else if (event_id == WEBSOCKET_EVENT_ERROR && data != NULL) {
        char line[96];
        snprintf(line, sizeof(line), "WebSocket error: HTTP %d, socket errno %d",
                 data->error_handle.esp_ws_handshake_status_code,
                 data->error_handle.esp_transport_sock_errno);
        device_control_log('E', TAG, line);
    } else if (event_id == WEBSOCKET_EVENT_DATA && data->op_code == 0x8) {
        if (data->data_len >= 2) {
            unsigned close_code = ((unsigned char)data->data_ptr[0] << 8) |
                                  (unsigned char)data->data_ptr[1];
            ESP_LOGW(TAG, "Server closed WebSocket: code=%u", close_code);
            char line[64];
            snprintf(line, sizeof(line), "Server closed WebSocket: %u", close_code);
            device_control_log('W', TAG, line);
            if (close_code == 1008) {
                ESP_LOGW(TAG, "Registration rejected; check that Hub %s is registered and active on the main server",
                         s_device_code);
            }
        }
    } else if (event_id == WEBSOCKET_EVENT_DATA && data->op_code == 0x1) {
        /* The component may split a WebSocket text payload across data events. */
        if (data->payload_offset == 0) received = 0;
        if (data->payload_len >= sizeof(message) || data->payload_offset != received ||
            received + data->data_len >= sizeof(message)) {
            received = 0;
            return;
        }
        memcpy(message + received, data->data_ptr, data->data_len);
        received += data->data_len;
        if (received == data->payload_len) {
            message[received] = '\0';
            handle_message(message);
            received = 0;
        }
    }
}

static void sound_task(void *arg)
{
    (void)arg;
    sound_command_t command;
    for (;;) {
        if (xQueueReceive(s_commands, &command, portMAX_DELAY) == pdTRUE) {
            if (command.generation != s_cancel_generation) {
                send_result(command.request_id, "stopped");
                continue;
            }
            ESP_LOGI(TAG, "Web requested sound: %s", command.sound);
            char line[64];
            snprintf(line, sizeof(line), "Web requested sound: %s", command.sound);
            device_control_log('I', "AUDIO", line);
            esp_err_t err = audio_play(sound_path(command.sound));
            send_result(command.request_id,
                        command.generation != s_cancel_generation ? "stopped" :
                        err == ESP_OK ? "completed" :
                        err == ESP_ERR_INVALID_STATE ? "busy" : "error");
        }
    }
}

static void log_mpu_diagnostic(void)
{
    lumo_band_diagnostic_t sample;
    lumo_band_get_diagnostic(&sample);
    const uint64_t now_ms = esp_timer_get_time() / 1000ULL;
    char line[192];
    char level = 'I';
    if (!sample.connected) {
        level = 'W';
        snprintf(line, sizeof(line), "Band BLE disconnected; no current MPU data");
    } else if (!sample.has_sample) {
        level = 'W';
        snprintf(line, sizeof(line), "Band BLE connected; waiting for MPU samples");
    } else if (now_ms - sample.received_at_ms > 6000) {
        level = 'W';
        snprintf(line, sizeof(line), "Band data stale: no BLE sample for %llums",
                 (unsigned long long)(now_ms - sample.received_at_ms));
    } else if (sample.has_diagnostic && now_ms - sample.diagnostic_at_ms > 6000) {
        level = 'W';
        snprintf(line, sizeof(line), "MPU diagnostic stale: no 6-axis packet for %llums",
                 (unsigned long long)(now_ms - sample.diagnostic_at_ms));
    } else if (sample.state == 4) {
        level = 'E';
        snprintf(line, sizeof(line), "MPU SENSOR_OFFLINE reported by Band; check sensor wiring/I2C");
    } else if (!sample.has_diagnostic) {
        snprintf(line, sizeof(line), "Legacy Band: |a|=%.2fg peak=%.2fg; update Band for ax/ay/az and gyro",
                 (double)sample.magnitude_x100 / 100.0, (double)sample.peak_x100 / 100.0);
    } else {
        uint64_t age_ms = sample.sensor_age_ms + now_ms - sample.diagnostic_at_ms;
        if (age_ms > 6000) {
            level = 'W';
            snprintf(line, sizeof(line), "MPU sample stale: seq=%u age=%llums; values withheld",
                     sample.sequence, (unsigned long long)age_ms);
        } else {
            /* MPU6050: accelerometer +/-8g = 4096 LSB/g; gyro +/-250dps = 131 LSB/dps.
             * Only motion diagnostics; synthetic HR/steps/battery are excluded. */
            snprintf(line, sizeof(line),
                     "MPU seq=%u age=%llums ax=%.2f ay=%.2f az=%.2fg gx=%.1f gy=%.1f gz=%.1fdps |a|=%.2fg peak=%.2fg",
                     sample.sequence, (unsigned long long)age_ms,
                     (double)sample.accel_raw[0] / 4096.0, (double)sample.accel_raw[1] / 4096.0,
                     (double)sample.accel_raw[2] / 4096.0, (double)sample.gyro_raw[0] / 131.0,
                     (double)sample.gyro_raw[1] / 131.0, (double)sample.gyro_raw[2] / 131.0,
                     (double)sample.magnitude_x100 / 100.0, (double)sample.peak_x100 / 100.0);
        }
    }
    device_control_log(level, "MPU6050", line);
    if (level == 'E') ESP_LOGE("MPU6050", "%s", line);
    else if (level == 'W') ESP_LOGW("MPU6050", "%s", line);
    else ESP_LOGI("MPU6050", "%s", line);
}

static void connection_task(void *arg)
{
    (void)arg;
    /* Certificate validation requires synchronized time. SNTP is started by
     * runtime even when Wi-Fi is configured later through the captive portal. */
    ESP_LOGI(TAG, "Waiting for WiFi and synchronized time before connecting to main server");
    while (!wifi_is_connected() || time(NULL) < 1704067200) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    esp_err_t err = esp_websocket_client_start(s_client);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Cannot start WebSocket: %s", esp_err_to_name(err));
        vTaskDelete(NULL);
        return;
    }
    uint32_t last_ping_ms = 0;
    uint32_t last_status_ms = 0;
    uint32_t last_mpu_ms = 0;
    for (;;) {
        if (wifi_is_connected() && esp_websocket_client_is_connected(s_client)) {
            uint32_t now_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
            if (s_hello_pending) {
                uint32_t generation = s_connection_generation;
                if (send_hello() && generation == s_connection_generation) {
                    s_hello_pending = false;
                }
            } else if (s_registration_ready && (uint32_t)(now_ms - last_ping_ms) >= 25000) {
                /* Never send a plain-text ping before the JSON hello. */
                esp_websocket_client_send_text(s_client, "ping", 4, pdMS_TO_TICKS(1000));
                last_ping_ms = now_ms;
            }
            if (!s_registration_ready && s_connected_at_ms != 0 &&
                (uint32_t)(now_ms - s_connected_at_ms) > 15000) {
                ESP_LOGW(TAG, "Backend did not confirm registration; restarting WebSocket");
                esp_websocket_client_stop(s_client);
                esp_websocket_client_start(s_client);
            }
            if (s_registration_ready) {
                if ((uint32_t)(now_ms - last_mpu_ms) >= 2000) {
                    log_mpu_diagnostic();
                    last_mpu_ms = now_ms;
                }
                if ((uint32_t)(now_ms - last_status_ms) >= 30000) {
                    char line[96];
                    snprintf(line, sizeof(line), "Heartbeat: uptime=%lus, free_heap=%lu bytes",
                             (unsigned long)(now_ms / 1000), (unsigned long)esp_get_free_heap_size());
                    device_control_log('I', "HUB", line);
                    last_status_ms = now_ms;
                }
                flush_logs();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

esp_err_t device_control_start(const char *device_code, const char *firmware_version)
{
    snprintf(s_device_code, sizeof(s_device_code), "%s", device_code);
    snprintf(s_firmware_version, sizeof(s_firmware_version), "%s", firmware_version);
    int length = snprintf(s_uri, sizeof(s_uri), "%s?device_id=%s",
                          CONFIG_LUMO_CONTROL_WS_URL, device_code);
    if (length < 0 || length >= sizeof(s_uri)) return ESP_ERR_INVALID_SIZE;
    s_logs = xQueueCreate(24, sizeof(device_log_t));
    if (s_logs == NULL) return ESP_ERR_NO_MEM;
    char startup[96];
    snprintf(startup, sizeof(startup), "Firmware %s; device=%s", firmware_version, device_code);
    device_control_log('I', "HUB", startup);
    device_control_log('I', "WIFI", wifi_is_connected() ? "WiFi connected" : "Waiting for WiFi");
    s_commands = xQueueCreate(1, sizeof(sound_command_t));
    if (s_commands == NULL) return ESP_ERR_NO_MEM;
    const esp_websocket_client_config_t config = {
        .uri = s_uri,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .reconnect_timeout_ms = 5000,
        .enable_close_reconnect = true,
        .network_timeout_ms = 10000,
        .ping_interval_sec = 20,
        .task_stack = 8192,
        .buffer_size = 1024,
    };
    s_client = esp_websocket_client_init(&config);
    if (s_client == NULL) {
        vQueueDelete(s_commands);
        s_commands = NULL;
        return ESP_ERR_NO_MEM;
    }
    esp_err_t err = esp_websocket_register_events(s_client, WEBSOCKET_EVENT_ANY, websocket_event, NULL);
    if (err != ESP_OK) return err;
    if (xTaskCreate(sound_task, "web_sound", 8192, NULL, 4, NULL) != pdPASS ||
        xTaskCreate(connection_task, "web_connect", 6144, NULL, 3, NULL) != pdPASS) {
        return ESP_ERR_NO_MEM;
    }
    ESP_LOGI(TAG, "Web control configured: %s", s_uri);
    return ESP_OK;
}
