#include "http_api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#include "esp_log.h"
#include "esp_http_client.h"
#include "cJSON.h"
#include "esp_crt_bundle.h"

static const char *TAG = "HTTP_API";

extern const char server_cert_pem_start[] asm("_binary_server_cert_pem_start");
extern const char server_cert_pem_end[] asm("_binary_server_cert_pem_end");

typedef struct
{
    char *buffer;
    int length;
} http_response_buffer_t;

static void log_file_size(const char *path)
{
    FILE *f = fopen(path, "rb");
    if (!f)
    {
        ESP_LOGW(TAG, "File not found: %s", path);
        return;
    }

    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fclose(f);

    ESP_LOGI(TAG, "File size: %s = %ld bytes", path, sz);
}

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    http_response_buffer_t *resp = (http_response_buffer_t *)evt->user_data;

    if (evt->event_id == HTTP_EVENT_ON_DATA && evt->data_len > 0 && resp != NULL)
    {
        char *new_buf = realloc(resp->buffer, resp->length + evt->data_len + 1);
        if (new_buf == NULL)
        {
            ESP_LOGE(TAG, "realloc failed");
            return ESP_ERR_NO_MEM;
        }

        resp->buffer = new_buf;
        memcpy(resp->buffer + resp->length, evt->data, evt->data_len);
        resp->length += evt->data_len;
        resp->buffer[resp->length] = '\0'; // an toàn cho text; không ảnh hưởng binary
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
esp_err_t http_api_upload_audio_get_audio(const char *server_url,
                                          const char *upload_path,
                                          const char *out_audio_path)
{
    esp_err_t err = ESP_FAIL;
    esp_http_client_handle_t client = NULL;
    FILE *f = NULL;
    uint8_t *file_buf = NULL;
    uint8_t *body_buf = NULL;

    http_response_buffer_t resp = {.buffer = NULL, .length = 0};

    // ── 1. Đọc file WAV ghi âm ────────────────────────────────
    f = fopen(upload_path, "rb");
    if (!f)
    {
        ESP_LOGE(TAG, "Cannot open upload file: %s", upload_path);
        return ESP_FAIL;
    }

    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (file_size <= 0)
    {
        ESP_LOGE(TAG, "Empty or invalid file: %s", upload_path);
        fclose(f);
        return ESP_FAIL;
    }

    file_buf = malloc(file_size);
    if (!file_buf)
    {
        fclose(f);
        return ESP_ERR_NO_MEM;
    }
    fread(file_buf, 1, file_size, f);
    fclose(f);
    f = NULL;

    ESP_LOGI(TAG, "Uploading %ld bytes from %s", file_size, upload_path);

    // ── 2. Build multipart/form-data ─────────────────────────
    const char *part_header =
        "------ESP32Boundary\r\n"
        "Content-Disposition: form-data; name=\"audio\"; filename=\"record.wav\"\r\n"
        "Content-Type: audio/wav\r\n\r\n";
    const char *part_footer = "\r\n------ESP32Boundary--\r\n";

    size_t body_len = strlen(part_header) + (size_t)file_size + strlen(part_footer);
    body_buf = malloc(body_len);
    if (!body_buf)
    {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    memcpy(body_buf, part_header, strlen(part_header));
    memcpy(body_buf + strlen(part_header), file_buf, file_size);
    memcpy(body_buf + strlen(part_header) + file_size, part_footer, strlen(part_footer));

    // ── 3. HTTP POST ──────────────────────────────────────────
    esp_http_client_config_t config = {
        .url = server_url,
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .user_data = &resp,
        .timeout_ms = 60000, // TTS có thể chậm hơn, đặt 60s
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
    esp_http_client_set_post_field(client, (const char *)body_buf, body_len);

    err = esp_http_client_perform(client);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "HTTP POST failed: %s", esp_err_to_name(err));
        goto cleanup;
    }

    int status = esp_http_client_get_status_code(client);
    ESP_LOGI(TAG, "HTTP status=%d, response_len=%d", status, resp.length);

    if (status != 200 || resp.buffer == NULL || resp.length < 44)
    {
        // WAV header tối thiểu 44 bytes
        ESP_LOGE(TAG, "Invalid audio response (status=%d, len=%d)", status, resp.length);
        err = ESP_FAIL;
        goto cleanup;
    }

    // ── 4. Lưu WAV nhận về vào SPIFFS ────────────────────────
    ESP_LOGI(TAG, "Saving response to: %s", out_audio_path);
    log_file_size("/spiffs/record.wav");
    log_file_size("/spiffs/response.wav");
    remove(out_audio_path);

    FILE *out_f = fopen(out_audio_path, "wb");
    if (!out_f)
    {
        ESP_LOGE(TAG, "Cannot open output file: %s", out_audio_path);
        err = ESP_FAIL;
        goto cleanup;
    }

    size_t written = fwrite(resp.buffer, 1, resp.length, out_f);
    ESP_LOGI(TAG, "resp.buffer=%p resp.length=%d", resp.buffer, resp.length);
    ESP_LOGE(TAG, "fwrite failed, errno=%d", errno);
    perror("fwrite");
    fclose(out_f);

    if (written != (size_t)resp.length)
    {
        ESP_LOGE(TAG, "Write incomplete: %u/%d bytes", (unsigned)written, resp.length);
        err = ESP_FAIL;
        goto cleanup;
    }

    ESP_LOGI(TAG, "Audio response saved to %s (%u bytes)", out_audio_path, (unsigned)written);
    err = ESP_OK;

cleanup:
    if (client)
        esp_http_client_cleanup(client);
    free(file_buf);
    free(body_buf);
    free(resp.buffer);
    return err;
}

// ============================================================
// POST JSON body → nhận response text hoặc status
// ============================================================
esp_err_t http_api_post_json(const char *url, const char *json_body, int *out_status)
{
    if (url == NULL || json_body == NULL)
    {
        return ESP_ERR_INVALID_ARG;
    }

    http_response_buffer_t resp = {.buffer = NULL, .length = 0};

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .user_data = &resp,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL)
    {
        ESP_LOGE(TAG, "http_api_post_json: esp_http_client_init failed");
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_body, strlen(json_body));

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK)
    {
        int status = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "POST %s → status=%d", url, status);
        if (out_status != NULL)
        {
            *out_status = status;
        }
    }
    else
    {
        ESP_LOGE(TAG, "POST %s failed: %s", url, esp_err_to_name(err));
    }

    free(resp.buffer);
    esp_http_client_cleanup(client);
    return err;
}