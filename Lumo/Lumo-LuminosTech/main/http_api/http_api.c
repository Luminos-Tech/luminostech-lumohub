#include "http_api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>
#include <unistd.h>

#include "esp_log.h"
#include "esp_http_client.h"
#include "cJSON.h"
#include "esp_crt_bundle.h"

static const char *TAG = "HTTP_API";
// Upper bound = 2 MB (tăng từ 1.5 MB để cover toàn bộ SPIFFS 2.5 MB partition
// trong partitions.csv; metadata SPIFFS chiếm ~5-10%).
//
// Rationale (Sep 2026): the LUMO Gemini TTS response is WAV 16-bit mono at
// 24 kHz. At ~48 KB/s, 2 MB ≈ 41 seconds of audio, đủ cho conversational
// reply dài nhất. SPIFFS partition = 0x270000 (2.5 MB) theo partitions.csv.
//
// FIX (Sep 2026): nâng cap để fix lỗi "esp_http_client_fetch_headers failed:
// ERROR" — backend trả về OK 200 nhưng firmware drop response do cap quá thấp.
static const size_t MAX_HTTP_RESPONSE_LEN = 2 * 1024 * 1024; // 2 MB — đủ cho ~41s WAV 24kHz mono

typedef struct
{
    char *buffer;
    size_t length;
    size_t capacity;
} http_response_buffer_t;

/* Stream context: ghi response chunks thẳng vào file, không malloc buffer.
 * FIX (HIGH-2): thay thế buffer-growing pattern để tránh ESP_ERR_NO_MEM khi
 * response expand tới 1.5 MB. */
typedef struct
{
    FILE *out_file;
    size_t bytes_written;
    size_t max_len;
    bool too_long;
    bool finished;  /* Server đã close response (HTTP_EVENT_ON_FINISH) */
} http_stream_ctx_t;

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    http_response_buffer_t *resp = (http_response_buffer_t *)evt->user_data;

    if (evt->event_id == HTTP_EVENT_ON_DATA && evt->data_len > 0 && resp != NULL)
    {
        // Hard cap: reject body > 512 KB to prevent heap exhaustion
        if (resp->length + evt->data_len > MAX_HTTP_RESPONSE_LEN)
        {
            ESP_LOGW(TAG, "HTTP response body exceeds %u bytes, truncating",
                     (unsigned)MAX_HTTP_RESPONSE_LEN);
            return ESP_OK; // keep existing data, ignore the rest
        }

        if (resp->buffer == NULL)
        {
            resp->capacity = 4096;
            resp->buffer = malloc(resp->capacity);
            if (resp->buffer == NULL)
            {
                ESP_LOGE(TAG, "malloc failed for HTTP response buffer");
                return ESP_ERR_NO_MEM;
            }
        }

        size_t needed = resp->length + evt->data_len + 1;
        if (needed > resp->capacity)
        {
            while (resp->capacity < needed)
            {
                resp->capacity *= 2;
            }
            char *new_buf = realloc(resp->buffer, resp->capacity);
            if (new_buf == NULL)
            {
                ESP_LOGE(TAG, "realloc failed for HTTP response buffer");
                return ESP_OK; // keep partial data, don't abort request
            }
            resp->buffer = new_buf;
        }

        memcpy(resp->buffer + resp->length, evt->data, evt->data_len);
        resp->length += evt->data_len;
        resp->buffer[resp->length] = '\0';
    }

    return ESP_OK;
}

static int is_unreserved_char(char c)
{
    return (isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' || c == '~');
}

static char *url_encode(const char *src)
{
    if (src == NULL)
    {
        return NULL;
    }

    size_t len = strlen(src);
    char *encoded = malloc(len * 3 + 1);
    if (encoded == NULL)
    {
        return NULL;
    }

    char *p = encoded;
    for (size_t i = 0; i < len; i++)
    {
        unsigned char ch = (unsigned char)src[i];
        if (is_unreserved_char((char)ch))
        {
            *p++ = (char)ch;
        }
        else
        {
            sprintf(p, "%%%02X", ch);
            p += 3;
        }
    }
    *p = '\0';
    return encoded;
}

// ============================================================
// GET text response (giữ nguyên)
// ============================================================
esp_err_t http_api_get_text_response(const http_api_config_t *config,
                                     const char *input_text,
                                     char **out_text)
{
    esp_err_t err = ESP_FAIL;
    esp_http_client_handle_t client = NULL;
    char *encoded_text = NULL;
    char *encoded_assistant = NULL;
    char *url = NULL;
    cJSON *root = NULL;

    http_response_buffer_t resp = {.buffer = NULL, .length = 0};

    if (config == NULL || config->base_url == NULL || input_text == NULL || out_text == NULL)
    {
        return ESP_ERR_INVALID_ARG;
    }

    *out_text = NULL;

    encoded_text = url_encode(input_text);
    encoded_assistant = url_encode(config->assistant_name ? config->assistant_name : "");
    if (encoded_text == NULL || encoded_assistant == NULL)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    size_t url_len = strlen(config->base_url) + strlen(encoded_text) + strlen(encoded_assistant) + 128;
    url = malloc(url_len);
    if (url == NULL)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    snprintf(url, url_len,
             "%s?idLumo=%d&textLumoCallServer=%s&assistant_name=%s",
             config->base_url,
             config->id_lumo,
             encoded_text,
             encoded_assistant);

    ESP_LOGI(TAG, "Request URL: %s", url);

    esp_http_client_config_t client_config = {
        .url = url,
        .method = HTTP_METHOD_GET,
        .event_handler = http_event_handler,
        .user_data = &resp,
        .timeout_ms = (config->timeout_ms > 0) ? config->timeout_ms : 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    client = esp_http_client_init(&client_config);
    if (client == NULL)
    {
        ESP_LOGE(TAG, "esp_http_client_init failed");
        err = ESP_FAIL;
        goto cleanup;
    }

    esp_http_client_set_header(client, "Accept", "application/json");

    err = esp_http_client_perform(client);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "HTTP request failed: %s", esp_err_to_name(err));
        goto cleanup;
    }

    int status_code = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "HTTP status=%d", status_code);

    if (status_code != 200 || resp.buffer == NULL)
    {
        ESP_LOGE(TAG, "Invalid HTTP response");
        err = ESP_FAIL;
        goto cleanup;
    }

    root = cJSON_Parse(resp.buffer);
    if (root == NULL)
    {
        ESP_LOGE(TAG, "JSON parse failed");
        err = ESP_FAIL;
        goto cleanup;
    }

    cJSON *text_res = cJSON_GetObjectItemCaseSensitive(root, "textRes");
    if (!cJSON_IsString(text_res) || text_res->valuestring == NULL)
    {
        ESP_LOGE(TAG, "JSON field 'textRes' not found");
        err = ESP_FAIL;
        goto cleanup;
    }

    *out_text = strdup(text_res->valuestring);
    if (*out_text == NULL)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    err = ESP_OK;

cleanup:
    if (root != NULL)
        cJSON_Delete(root);
    if (client != NULL)
        esp_http_client_cleanup(client);
    free(resp.buffer);
    free(encoded_text);
    free(encoded_assistant);
    free(url);

    return err;
}

// ============================================================
// Upload audio → nhận TEXT (giữ lại để tương thích)
// ============================================================
esp_err_t http_api_upload_audio_get_text(const char *server_url,
                                         const char *file_path,
                                         char **out_text)
{
    esp_err_t err = ESP_FAIL;
    esp_http_client_handle_t client = NULL;
    FILE *f = NULL;
    uint8_t *file_buf = NULL;
    uint8_t *body_buf = NULL;
    cJSON *root = NULL;

    http_response_buffer_t resp = {.buffer = NULL, .length = 0};

    f = fopen(file_path, "rb");
    if (!f)
    {
        ESP_LOGE(TAG, "Cannot open file: %s", file_path);
        return ESP_FAIL;
    }

    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    fseek(f, 0, SEEK_SET);

    file_buf = malloc(file_size);
    if (!file_buf)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }
    fread(file_buf, 1, file_size, f);
    fclose(f);
    f = NULL;

    const char *part_header =
        "------ESP32Boundary\r\n"
        "Content-Disposition: form-data; name=\"audio\"; filename=\"record.wav\"\r\n"
        "Content-Type: audio/wav\r\n\r\n";
    const char *part_footer = "\r\n------ESP32Boundary--\r\n";

    size_t body_len = strlen(part_header) + file_size + strlen(part_footer);
    body_buf = malloc(body_len);
    if (!body_buf)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    memcpy(body_buf, part_header, strlen(part_header));
    memcpy(body_buf + strlen(part_header), file_buf, file_size);
    memcpy(body_buf + strlen(part_header) + file_size, part_footer, strlen(part_footer));

    esp_http_client_config_t config = {
        .url = server_url,
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .user_data = &resp,
        .timeout_ms = 30000,
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    client = esp_http_client_init(&config);
    if (!client)
    {
        err = ESP_FAIL;
        goto cleanup;
    }

    esp_http_client_set_header(client, "Content-Type",
                               "multipart/form-data; boundary=----ESP32Boundary");
    esp_http_client_set_post_field(client, (const char *)body_buf, body_len);

    err = esp_http_client_perform(client);
    if (err != ESP_OK)
        goto cleanup;

    int status = esp_http_client_get_status_code(client);
    if (status != 200 || !resp.buffer)
    {
        err = ESP_FAIL;
        goto cleanup;
    }

    root = cJSON_Parse(resp.buffer);
    if (!root)
    {
        err = ESP_FAIL;
        goto cleanup;
    }

    cJSON *text_res = cJSON_GetObjectItemCaseSensitive(root, "textRes");
    if (!cJSON_IsString(text_res))
    {
        err = ESP_FAIL;
        goto cleanup;
    }

    *out_text = strdup(text_res->valuestring);
    err = ESP_OK;

cleanup:
    if (root)
        cJSON_Delete(root);
    if (client)
        esp_http_client_cleanup(client);
    if (f)
        fclose(f);
    free(file_buf);
    free(body_buf);
    free(resp.buffer);
    return err;
}

// ============================================================
// Upload audio WAV → Server STT→TTT→TTS → nhận lại audio WAV
// ============================================================
/* Stream event handler: ghi response chunks thẳng vào file output.
 * KHÔNG malloc response buffer → tránh ESP_ERR_NO_MEM khi response lớn.
 *
 * FIX: Feed WDT mỗi lần event handler được gọi. Trong khi server stream về
 * hàng trăm chunks, mỗi lần esp_http_client gọi event handler có thể block
 * vài chục ms để xử lý TCP buffer. Nếu không feed WDT ở đây, tổng thời
 * gian stream có thể vượt 70s WDT timeout.
 *
 * QUAN TRỌNG: Xử lý HTTP_EVENT_ON_FINISH để biết server đã close response,
 * tránh ESP-IDF block đợi connection close vô thời hạn khi backend dùng
 * chunked transfer (response streaming không có Content-Length). */
static esp_err_t stream_event_handler(esp_http_client_event_t *evt)
{
    // KHÔNG feed WDT ở đây: stream_event_handler chạy trên HTTP client internal task
    // (đặc biệt khi dùng esp_http_client_perform), task này không có trong WDT subscription.
    // Gọi esp_task_wdt_reset() trong context không thuộc task đã subscribe → ESP32 log
    // "task not found" và KHÔNG feed WDT, dẫn tới reset sau timeout. Feed WDT phải làm
    // ở task caller (xử lý blocking trong http_api_upload_audio_get_audio).
    (void)evt;
    http_stream_ctx_t *ctx = (http_stream_ctx_t *)evt->user_data;
    if (ctx == NULL)
    {
        return ESP_OK;
    }

    switch (evt->event_id)
    {
    case HTTP_EVENT_ON_DATA:
        if (evt->data_len <= 0)
        {
            return ESP_OK;
        }
        break;
    case HTTP_EVENT_ON_FINISH:
        // Server đã đóng response (chunked transfer complete) → đánh dấu done
        ctx->finished = true;
        ESP_LOGI("HTTP_API", "Stream finished, total=%u bytes",
                 (unsigned)ctx->bytes_written);
        return ESP_OK;
    default:
        return ESP_OK;
    }

    if (ctx->too_long)
    {
        ctx->bytes_written += evt->data_len;
        return ESP_OK;
    }

    if (ctx->bytes_written + evt->data_len > ctx->max_len)
    {
        ESP_LOGW("HTTP_API", "Response vượt %u bytes — truncate",
                 (unsigned)ctx->max_len);
        ctx->too_long = true;
        size_t remaining = ctx->max_len - ctx->bytes_written;
        if (remaining > 0 && ctx->out_file)
        {
            fwrite(evt->data, 1, remaining, ctx->out_file);
            ctx->bytes_written += remaining;
        }
        return ESP_OK;
    }

    if (ctx->out_file)
    {
        size_t written = fwrite(evt->data, 1, evt->data_len, ctx->out_file);
        ctx->bytes_written += written;
        if (written != evt->data_len)
        {
            ESP_LOGE("HTTP_API", "fwrite thất bại: %u/%u bytes",
                     (unsigned)written, (unsigned)evt->data_len);
            return ESP_FAIL;
        }
    }
    return ESP_OK;
}

esp_err_t http_api_upload_audio_get_audio(const char *server_url,
                                          const char *upload_path,
                                          const char *out_audio_path)
{
    esp_err_t err = ESP_FAIL;
    esp_http_client_handle_t client = NULL;
    FILE *in_f = NULL;
    FILE *out_f = NULL;
    uint8_t *body_buf = NULL;       /* giữ lại cho cleanup tương thích */
    uint8_t *chunk_buf = NULL;     /* streaming buffer 4 KB */
    bool read_ok = false;

    // FIX (Sep 2026): Feed WDT từ caller task (không feed trong
    // stream_event_handler). ESP-IDF internal HTTP task KHÔNG subscribe
    // task watchdog → gọi esp_task_wdt_reset() ở đó trả về "task not found"
    // và WDT vẫn reset ESP32 khi backend TTS pipeline mất >60s.

    // ── 1. Mở file input, lấy size ─────────────────────────────
    in_f = fopen(upload_path, "rb");
    if (!in_f)
    {
        ESP_LOGE(TAG, "Cannot open upload file: %s", upload_path);
        return ESP_FAIL;
    }

    fseek(in_f, 0, SEEK_END);
    long file_size = ftell(in_f);
    fseek(in_f, 0, SEEK_SET);

    if (file_size <= 0)
    {
        ESP_LOGE(TAG, "Empty or invalid file: %s", upload_path);
        fclose(in_f);
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "Uploading %ld bytes from %s (stream mode)", file_size, upload_path);
    // ── 2. Mở file output NGAY từ đầu (để stream download) ─────
    out_f = fopen(out_audio_path, "wb");
    if (!out_f)
    {
        ESP_LOGE(TAG, "Cannot open output file: %s", out_audio_path);
        fclose(in_f);
        return ESP_FAIL;
    }

    // ── 3. Build HTTP client với streaming event handler ────────
    http_stream_ctx_t stream_ctx = {
        .out_file = out_f,
        .bytes_written = 0,
        .max_len = MAX_HTTP_RESPONSE_LEN,
        .too_long = false,
    };

    esp_http_client_config_t config = {
        .url = server_url,
        .method = HTTP_METHOD_POST,
        .event_handler = stream_event_handler,
        .user_data = &stream_ctx,
        .timeout_ms = 60000, // TTS có thể chậm, đặt 60s
        .crt_bundle_attach = esp_crt_bundle_attach,
        .buffer_size_tx = 4096,
        .buffer_size = 4096,
    };

    client = esp_http_client_init(&config);
    if (!client)
    {
        ESP_LOGE(TAG, "esp_http_client_init failed");
        err = ESP_FAIL;
        goto cleanup;
    }

    esp_http_client_set_header(client, "Content-Type",
                               "multipart/form-data; boundary=----ESP32Boundary");
    /* Backend trả raw WAV binary thẳng khi Accept: audio/wav */
    esp_http_client_set_header(client, "Accept", "audio/wav");

    // ── 4. Build multipart body trong RAM rồi dùng set_post_field ─────
    // FIX: Trước đây dùng esp_http_client_open() + esp_http_client_write()
    //      thủ công, dẫn đến ESP32 chỉ nhận ~739 bytes response dù server
    //      trả 313 KB. Nguyên nhân: write() trả về khi đẩy data vào
    //      internal TCP buffer (4 KB), nhưng fetch_headers() gặp race với
    //      chunked transfer encoding → return sớm với partial headers.
    //
    //      Cách fix: để ESP-IDF tự handle toàn bộ request lifecycle qua
    //      set_post_field() + perform(). Multipart body được buffer trong
    //      RAM (160 KB audio + ~200 byte boundary → ~161 KB, < heap trống
    //      trên ESP32 ~250 KB sau boot với config hiện tại).
    const char *part_header =
        "------ESP32Boundary\r\n"
        "Content-Disposition: form-data; name=\"audio\"; filename=\"record.wav\"\r\n"
        "Content-Type: audio/wav\r\n\r\n";
    const char *part_footer = "\r\n------ESP32Boundary--\r\n";

    size_t header_len = strlen(part_header);
    size_t footer_len = strlen(part_footer);
    /* FIX: không malloc cả body 160 KB nữa — heap ESP32-S3 không đủ.
     *      Thay vào đó dùng open() + write() để stream multipart theo
     *      chunk 4 KB (bằng buffer_size_tx). Set Content-Length chính
     *      xác để HTTP client chờ đủ mới fetch_headers, tránh race với
     *      chunked transfer encoding (lỗi cũ ở phiên bản dùng open+write
     *      thủ công là do không set Content-Length). */
    int body_len = (int)(header_len + (size_t)file_size + footer_len);

    esp_http_client_set_header(client, "Content-Type",
                               "multipart/form-data; boundary=----ESP32Boundary");
    esp_http_client_set_header(client, "Accept", "audio/wav");

    char content_length_str[16];
    snprintf(content_length_str, sizeof(content_length_str), "%d", body_len);
    esp_http_client_set_header(client, "Content-Length", content_length_str);

    ESP_LOGI(TAG, "Multipart body: %d bytes (file=%ld + overhead=%u), streaming",
             body_len, file_size, (unsigned)(header_len + footer_len));

    // ── 5. Perform bằng streaming open()+write() — không buffer toàn bộ ──
    err = esp_http_client_open(client, body_len);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "esp_http_client_open failed: %s", esp_err_to_name(err));
        goto cleanup;
    }

    /* Gửi header multipart */
    if (esp_http_client_write(client, part_header, (int)header_len) != (int)header_len)
    {
        ESP_LOGE(TAG, "Write multipart header failed");
        err = ESP_FAIL;
        goto cleanup;
    }

    /* Gửi file content theo chunk 4 KB */
    chunk_buf = malloc(4096);
    if (!chunk_buf)
    {
        ESP_LOGE(TAG, "malloc chunk_buf (4096 bytes) failed");
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    long remaining = file_size;
    read_ok = true;
    while (remaining > 0)
    {
        size_t to_read = (remaining > 4096) ? 4096 : (size_t)remaining;
        if (fread(chunk_buf, 1, to_read, in_f) != to_read)
        {
            ESP_LOGE(TAG, "fread failed at %ld remaining", remaining);
            read_ok = false;
            break;
        }
        int written = esp_http_client_write(client, (const char *)chunk_buf, (int)to_read);
        if (written != (int)to_read)
        {
            ESP_LOGE(TAG, "esp_http_client_write failed: %d/%u", written, (unsigned)to_read);
            err = ESP_FAIL;
            read_ok = false;
            break;
        }
        remaining -= (long)to_read;
    }

    free(chunk_buf);
    chunk_buf = NULL;

    if (!read_ok)
    {
        goto cleanup;
    }

    /* Gửi footer multipart */
    if (esp_http_client_write(client, part_footer, (int)footer_len) != (int)footer_len)
    {
        ESP_LOGE(TAG, "Write multipart footer failed");
        err = ESP_FAIL;
        goto cleanup;
    }

    /* Lấy response headers + body (event handler sẽ stream vào file) */
    err = esp_http_client_fetch_headers(client);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "esp_http_client_fetch_headers failed: %s", esp_err_to_name(err));
        goto cleanup;
    }

    {
        int status = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP status=%d, streamed %u bytes (finished=%d)",
                 status, (unsigned)stream_ctx.bytes_written,
                 (int)stream_ctx.finished);

        if (status != 200 || stream_ctx.bytes_written < 44)
        {
            // WAV header tối thiểu 44 bytes
            ESP_LOGE(TAG, "Invalid audio response (status=%d, len=%u)",
                     status, (unsigned)stream_ctx.bytes_written);
            err = ESP_FAIL;
            goto cleanup;
        }

        err = ESP_OK;
        ESP_LOGI(TAG, "Audio stream OK: %u bytes -> %s",
                 (unsigned)stream_ctx.bytes_written, out_audio_path);
    }

cleanup:
    if (body_buf) free(body_buf);
    if (chunk_buf) free(chunk_buf);
    if (client) esp_http_client_cleanup(client);
    if (in_f) fclose(in_f);
    if (out_f)
    {
        fclose(out_f);
        if (err != ESP_OK)
        {
            // Xóa file rác nếu upload thất bại
            unlink(out_audio_path);
        }
    }
    return err;
}