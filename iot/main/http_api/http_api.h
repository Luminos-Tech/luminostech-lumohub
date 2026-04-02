#ifndef HTTP_API_H
#define HTTP_API_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C"
{
#endif

    typedef struct
    {
        const char *base_url;       // Ví dụ: https://lumo.vanha2301.online/ota
        const char *assistant_name; // Ví dụ: LUMO
        int id_lumo;                // Ví dụ: 1
        int timeout_ms;             // Ví dụ: 10000
    } http_api_config_t;

    /**
     * @brief Gọi server với text truyền vào, parse JSON và trả về field "textRes"
     *
     * @param config     Cấu hình server
     * @param input_text Text gửi lên server
     * @param out_text   Chuỗi kết quả cấp phát động, caller phải free()
     *
     * @return esp_err_t
     */
    esp_err_t http_api_get_text_response(const http_api_config_t *config,
                                         const char *input_text,
                                         char **out_text);

    /**
     * @brief Upload file WAV lên server, nhận lại text (deprecated - dùng http_api_upload_audio_get_audio)
     */
    esp_err_t http_api_upload_audio_get_text(const char *server_url,
                                             const char *file_path,
                                             char **out_text);

    /**
     * @brief Upload file WAV lên server.
     *        Server thực hiện: STT (Whisper) → TTT (version2) → TTS (Gemini).
     *        Nhận lại file WAV chứa giọng đọc phản hồi, lưu vào out_audio_path.
     *
     * @param server_url     URL endpoint upload (vd: https://lumohub.luminostech.tech/audio/)
     * @param upload_path    Đường dẫn file WAV ghi âm trên SPIFFS (vd: /spiffs/record.wav)
     * @param out_audio_path Đường dẫn lưu file WAV phản hồi    (vd: /spiffs/response.wav)
     *
     * @return ESP_OK nếu thành công
     */
    esp_err_t http_api_upload_audio_get_audio(const char *server_url,
                                              const char *upload_path,
                                              const char *out_audio_path);

    /**
     * @brief Gửi HTTP POST với body là JSON string, trả về HTTP status code.
     *        caller không cần cấp phát buffer.
     *
     * @param url         Full URL (vd: https://lumohub.luminostech.tech/api/v1/event-buttons)
     * @param json_body   JSON string (vd: {"device_id":"0001","time_button_click":"..."})
     * @param out_status  Pointer lưu HTTP status code (nullable)
     *
     * @return ESP_OK nếu perform thành công (không quan tâm status code server)
     */
    esp_err_t http_api_post_json(const char *url, const char *json_body, int *out_status);

#ifdef __cplusplus
}
#endif

#endif // HTTP_API_H