#include "ws_client.h"
#include "audio/audio_stream.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdatomic.h>
#include <ctype.h>

#include "esp_log.h"
#include "esp_websocket_client.h"
#include "esp_crt_bundle.h"

static const char *TAG = "WS_CLIENT";

#define SEND_QUEUE_SIZE  4
// WebSocket opcodes
#define WS_OPCODE_TEXT   0x1
#define WS_OPCODE_BINARY 0x2

// ─────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────
static esp_websocket_client_handle_t s_client = NULL;
static TaskHandle_t s_ws_task = NULL;

// send_queue: char* JSON messages to send (caller must free)
static QueueHandle_t s_send_queue = NULL;

// recv_queue: received audio chunks (uint8_t*, chunk_len)
// stream_task lấy ra → audio_stream_play
static QueueHandle_t s_audio_queue = NULL;

// recv_queue: received JSON text (char*) — done/error
static QueueHandle_t s_json_queue = NULL;

static ws_done_cb_t s_done_cb = NULL;
static volatile atomic_bool s_connected = ATOMIC_VAR_INIT(false);
static volatile atomic_bool s_running = ATOMIC_VAR_INIT(false);

// ─────────────────────────────────────────────────────────────
// Base64 encode (inline, no external lib)
// ─────────────────────────────────────────────────────────────
static size_t b64_encode(const uint8_t *in, size_t in_len, char *out)
{
    static const char tbl[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    size_t i = 0, o = 0;
    while (i < in_len)
    {
        uint8_t b0 = in[i++];
        uint8_t b1 = (i < in_len) ? in[i++] : 0;
        uint8_t b2 = (i < in_len) ? in[i++] : 0;
        out[o++] = tbl[b0 >> 2];
        out[o++] = tbl[((b0 & 3) << 4) | (b1 >> 4)];
        out[o++] = (i - 1 < in_len) ? tbl[((b1 & 15) << 2) | (b2 >> 6)] : '=';
        out[o++] = (i < in_len)     ? tbl[b2 & 63] : '=';
    }
    out[o] = '\0';
    return o;
}

// ─────────────────────────────────────────────────────────────
// Fast JSON parser: extract "type" and "message"/"stt" fields
// ─────────────────────────────────────────────────────────────
static void parse_json_reply(const char *raw, char *type_out, size_t type_size,
                             char *msg_out, size_t msg_size)
{
    type_out[0] = '\0';
    msg_out[0] = '\0';

    const char *p = raw;

    // tìm "type"
    const char *tp = strstr(p, "\"type\"");
    if (tp)
    {
        const char *colon = strchr(tp, ':');
        if (colon)
        {
            const char *val = colon + 1;
            while (*val && (isspace((unsigned char)*val) || *val == '"'))
                val++;
            size_t ti = 0;
            while (*val && !isspace((unsigned char)*val) &&
                   *val != ',' && *val != '}' && *val != '"' &&
                   ti + 1 < type_size)
                type_out[ti++] = *val++;
            type_out[ti] = '\0';
        }
    }

    // tìm "message" hoặc "stt"
    const char *mp = strstr(p, "\"message\"");
    if (!mp)
        mp = strstr(p, "\"stt\"");
    if (mp)
    {
        const char *colon = strchr(mp, ':');
        if (colon)
        {
            const char *val = colon + 1;
            while (*val && (isspace((unsigned char)*val) || *val == '"'))
                val++;
            size_t mi = 0;
            while (*val && !isspace((unsigned char)*val) &&
                   *val != ',' && *val != '}' && *val != '"' &&
                   mi + 1 < msg_size)
                msg_out[mi++] = *val++;
            msg_out[mi] = '\0';
        }
    }
}

// ─────────────────────────────────────────────────────────────
// WebSocket event handler — chạy trên lõi ESP-IDF (FreeRTOS)
// Dùng opcode để phân biệt binary vs text frame:
//   opcode 0x1 = text frame  (JSON done/error)
//   opcode 0x2 = binary frame (PCM audio)
// ─────────────────────────────────────────────────────────────
static void ws_event_handler(void *handler_args,
                             esp_event_base_t event_base,
                             int32_t event_id,
                             void *event_data)
{
    (void)handler_args;
    (void)event_base;

    switch ((esp_websocket_event_id_t)event_id)
    {
    case WEBSOCKET_EVENT_CONNECTED:
        ESP_LOGI(TAG, "WS CONNECTED");
        atomic_store(&s_connected, true);
        break;

    case WEBSOCKET_EVENT_DISCONNECTED:
        ESP_LOGI(TAG, "WS DISCONNECTED");
        atomic_store(&s_connected, false);
        break;

    case WEBSOCKET_EVENT_DATA:
    {
        // event_data là esp_websocket_event_data_t*
        esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;

        if (!data->data_ptr || data->data_len == 0)
            break;

        if (data->op_code == WS_OPCODE_TEXT)
        {
            // ── Text frame: JSON (done/error) ─────────────────
            size_t len = data->data_len;
            char *copy = malloc(len + 1);
            if (!copy)
                break;
            memcpy(copy, data->data_ptr, len);
            copy[len] = '\0';

            if (len < 200)
                ESP_LOGI(TAG, "WS JSON: %s", copy);
            else
                ESP_LOGI(TAG, "WS JSON: %.*s...", 199, copy);

            if (s_json_queue)
                xQueueSend(s_json_queue, &copy, 0);
            else
                free(copy);
        }
        else if (data->op_code == WS_OPCODE_BINARY)
        {
            // ── Binary frame: PCM audio chunk ─────────────────
            if (s_audio_queue && data->data_len > 0)
            {
                uint8_t *copy = malloc(data->data_len);
                if (copy)
                {
                    memcpy(copy, data->data_ptr, data->data_len);
                    if (xQueueSend(s_audio_queue, &copy, 0) != pdTRUE)
                    {
                        ESP_LOGW(TAG, "audio q full, drop %lu bytes",
                                 (unsigned long)data->data_len);
                        free(copy);
                    }
                    else
                    {
                        ESP_LOGD(TAG, "WS audio → stream: %lu bytes",
                                 (unsigned long)data->data_len);
                    }
                }
            }
        }
        break;
    }

    case WEBSOCKET_EVENT_ERROR:
        ESP_LOGE(TAG, "WS ERROR");
        atomic_store(&s_connected, false);
        break;

    default:
        break;
    }
}

// ─────────────────────────────────────────────────────────────
// WS background task
// ─────────────────────────────────────────────────────────────
static void ws_task(void *arg)
{
    (void)arg;

    uint8_t *audio_chunk = NULL;

    while (atomic_load(&s_running))
    {
        // ── Gửi message từ send_queue ───────────────────────
        if (s_send_queue && atomic_load(&s_connected))
        {
            char *msg = NULL;
            BaseType_t ok = xQueueReceive(s_send_queue, &msg, pdMS_TO_TICKS(10));
            if (ok == pdTRUE && msg)
            {
                int len = strlen(msg);
                int sent = esp_websocket_client_send_text(
                    s_client, msg, len, pdMS_TO_TICKS(5000));
                if (sent < 0)
                    ESP_LOGE(TAG, "WS send failed: %d", sent);
                else
                    ESP_LOGI(TAG, "WS sent %d bytes", sent);
                free(msg);
            }
        }

        // ── Đọc audio chunk → gửi vào I2S DMA ──────────────
        if (s_audio_queue)
        {
            BaseType_t ok = xQueueReceive(s_audio_queue, &audio_chunk, pdMS_TO_TICKS(10));
            if (ok == pdTRUE && audio_chunk)
            {
                // Nhận raw PCM 24kHz mono 16-bit
                // audio_stream_play() tự convert sang stereo
                esp_err_t err = audio_stream_play(audio_chunk, 1024);
                if (err != ESP_OK)
                    ESP_LOGW(TAG, "audio_stream_play: %s", esp_err_to_name(err));
                free(audio_chunk);
                audio_chunk = NULL;
            }
        }

        // ── Đọc JSON message → gọi callback ─────────────────
        if (s_json_queue)
        {
            char *json_msg = NULL;
            BaseType_t ok = xQueueReceive(s_json_queue, &json_msg, pdMS_TO_TICKS(10));
            if (ok == pdTRUE && json_msg)
            {
                char type_buf[32] = {0};
                char msg_buf[256] = {0};
                parse_json_reply(json_msg, type_buf, sizeof(type_buf),
                                 msg_buf, sizeof(msg_buf));
                ESP_LOGI(TAG, "WS done-cb: type='%s' msg='%s'", type_buf, msg_buf);
                if (s_done_cb)
                    s_done_cb(type_buf, msg_buf[0] ? msg_buf : NULL);
                free(json_msg);
            }
        }
    }

    ESP_LOGI(TAG, "ws_task exiting");
    vTaskDelete(NULL);
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

esp_err_t ws_client_init(const char *uri, ws_done_cb_t done_callback)
{
    if (!uri)
        return ESP_ERR_INVALID_ARG;

    s_done_cb = done_callback;
    atomic_store(&s_running, true);

    s_send_queue  = xQueueCreate(SEND_QUEUE_SIZE, sizeof(char *));
    s_audio_queue = xQueueCreate(SEND_QUEUE_SIZE * 4, sizeof(uint8_t *));
    s_json_queue  = xQueueCreate(SEND_QUEUE_SIZE, sizeof(char *));

    if (!s_send_queue || !s_audio_queue || !s_json_queue)
        return ESP_ERR_NO_MEM;

    esp_websocket_client_config_t cfg = {
        .uri = uri,
        .transport = WEBSOCKET_TRANSPORT_OVER_SSL,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .task_stack = 8192,
        .task_prio = 5,
        .buffer_size = 4096,
        .ping_interval_sec = 30,
    };

    s_client = esp_websocket_client_init(&cfg);
    if (!s_client)
    {
        ESP_LOGE(TAG, "esp_websocket_client_init failed");
        return ESP_FAIL;
    }

    ESP_ERROR_CHECK(esp_websocket_register_events(s_client,
                                                   WEBSOCKET_EVENT_ANY,
                                                   ws_event_handler,
                                                   NULL));

    BaseType_t ret = xTaskCreate(ws_task, "ws_task", 8192, NULL, 6, &s_ws_task);
    if (ret != pdPASS)
    {
        ESP_LOGE(TAG, "xTaskCreate ws_task failed");
        esp_websocket_client_destroy(s_client);
        s_client = NULL;
        return ESP_ERR_NO_MEM;
    }

    ESP_LOGI(TAG, "ws_client_init: %s", uri);
    return ESP_OK;
}

esp_err_t ws_client_connect(void)
{
    if (!s_client)
        return ESP_ERR_INVALID_STATE;

    esp_err_t err = esp_websocket_client_start(s_client);
    if (err != ESP_OK)
        ESP_LOGE(TAG, "esp_websocket_client_start: %s", esp_err_to_name(err));
    return err;
}

ws_state_t ws_client_state(void)
{
    if (!s_client)
        return WS_STATE_DISCONNECTED;
    if (atomic_load(&s_connected))
        return WS_STATE_CONNECTED;
    return WS_STATE_CONNECTING;
}

esp_err_t ws_client_send_text(const char *text)
{
    if (!s_client || !text)
        return ESP_ERR_INVALID_ARG;
    if (!atomic_load(&s_connected))
        return ESP_ERR_INVALID_STATE;

    char *payload = malloc(256 + strlen(text));
    if (!payload)
        return ESP_ERR_NO_MEM;

    int len = snprintf(payload, 256 + strlen(text),
                       "{\"action\":\"tts\",\"text\":\"%s\"}", text);
    if (len <= 0)
    {
        free(payload);
        return ESP_FAIL;
    }

    if (xQueueSend(s_send_queue, &payload, pdMS_TO_TICKS(100)) != pdTRUE)
    {
        free(payload);
        return ESP_FAIL;
    }
    return ESP_OK;
}

esp_err_t ws_client_send_file(const char *filepath)
{
    if (!filepath)
        return ESP_ERR_INVALID_ARG;
    if (!atomic_load(&s_connected))
        return ESP_ERR_INVALID_STATE;

    // ── Đọc file WAV ────────────────────────────────────────
    FILE *f = fopen(filepath, "rb");
    if (!f)
    {
        ESP_LOGE(TAG, "Cannot open: %s", filepath);
        return ESP_FAIL;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (fsize <= 0 || fsize > 500000)
    {
        ESP_LOGE(TAG, "File size invalid: %ld", fsize);
        fclose(f);
        return ESP_FAIL;
    }

    uint8_t *raw = malloc((size_t)fsize);
    if (!raw)
    {
        fclose(f);
        return ESP_ERR_NO_MEM;
    }

    if (fread(raw, 1, (size_t)fsize, f) != (size_t)fsize)
    {
        ESP_LOGE(TAG, "fread failed");
        free(raw);
        fclose(f);
        return ESP_FAIL;
    }
    fclose(f);

    // ── Base64 encode ────────────────────────────────────────
    size_t b64_len = ((size_t)fsize + 2) / 3 * 4 + 1;
    char *b64 = malloc(b64_len);
    if (!b64)
    {
        free(raw);
        return ESP_ERR_NO_MEM;
    }
    b64_encode(raw, (size_t)fsize, b64);
    free(raw);

    // ── Build JSON payload ────────────────────────────────────
    size_t json_len = 64 + strlen(b64);
    char *payload = malloc(json_len);
    if (!payload)
    {
        free(b64);
        return ESP_ERR_NO_MEM;
    }

    int written = snprintf(payload, json_len,
                           "{\"action\":\"stt_tts\",\"audio_b64\":\"%s\"}", b64);
    free(b64);

    if (written <= 0 || written >= (int)json_len)
    {
        free(payload);
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "WS file payload: %d bytes", written);

    if (xQueueSend(s_send_queue, &payload, pdMS_TO_TICKS(5000)) != pdTRUE)
    {
        ESP_LOGE(TAG, "send_queue full");
        free(payload);
        return ESP_FAIL;
    }
    return ESP_OK;
}

void ws_client_disconnect(void)
{
    atomic_store(&s_running, false);

    if (s_ws_task)
    {
        vTaskDelete(s_ws_task);
        s_ws_task = NULL;
    }

    if (s_client)
    {
        esp_websocket_client_stop(s_client);
        esp_websocket_client_destroy(s_client);
        s_client = NULL;
    }

    // Drain queues
    if (s_send_queue)
    {
        char *msg = NULL;
        while (xQueueReceive(s_send_queue, &msg, 0) == pdTRUE && msg)
            free(msg);
        vQueueDelete(s_send_queue);
        s_send_queue = NULL;
    }
    if (s_audio_queue)
    {
        uint8_t *p = NULL;
        while (xQueueReceive(s_audio_queue, &p, 0) == pdTRUE && p)
            free(p);
        vQueueDelete(s_audio_queue);
        s_audio_queue = NULL;
    }
    if (s_json_queue)
    {
        char *p = NULL;
        while (xQueueReceive(s_json_queue, &p, 0) == pdTRUE && p)
            free(p);
        vQueueDelete(s_json_queue);
        s_json_queue = NULL;
    }

    atomic_store(&s_connected, false);
    ESP_LOGI(TAG, "ws_client disconnected");
}
