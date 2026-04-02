#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

    /**
     * @brief LUMO WebSocket client — nhận TTS audio stream và phát ngay.
     *
     * Flow:
     *   1. gọi ws_client_init()
     *   2. gọi ws_client_connect()  → kết nối WS, nhận binary chunks
     *   3. gọi ws_client_send_text() → gửi yêu cầu TTS
     *   4. WS task nhận binary chunks → audio_stream_play() tự động
     *   5. Khi server gửi JSON {type:"done"|"error"} → callback được gọi
     *   6. Gọi ws_client_disconnect() khi xong
     */

    /** Trạng thái kết nối */
    typedef enum
    {
        WS_STATE_DISCONNECTED = 0,
        WS_STATE_CONNECTING,
        WS_STATE_CONNECTED,
        WS_STATE_ERROR,
    } ws_state_t;

    /** Callback khi nhận done/error từ server */
    typedef void (*ws_done_cb_t)(const char *type, const char *message);

    /**
     * @brief Khởi tạo WS client. Gọi 1 lần lúc start-up.
     *
     * @param uri            Full WS URI (wss://api.luminostech.tech/ws/lumo?device_id=0001)
     * @param done_callback  Callback khi nhận done/error (có thể NULL)
     */
    esp_err_t ws_client_init(const char *uri, ws_done_cb_t done_callback);

    /**
     * @brief Kết nối WebSocket (non-blocking, khởi động background task).
     *        Gọi ws_client_is_connected() để kiểm tra.
     *
     * @return ESP_OK nếu connection started
     */
    esp_err_t ws_client_connect(void);

    /**
     * @brief Kiểm tra đã connected chưa.
     */
    ws_state_t ws_client_state(void);

    /**
     * @brief Gửi yêu cầu TTS (plain text).
     *
     * @param text UTF-8 text cần LUMO trả lời bằng TTS
     *
     * @return ESP_OK nếu gửi thành công
     */
    esp_err_t ws_client_send_text(const char *text);

    /**
     * @brief Gửi file WAV qua WebSocket (bất đồng bộ, base64 encoded).
     *        ws_task sẽ đọc file, base64 encode, gửi JSON {action:"stt_tts", audio_b64:...}.
     *
     * @param filepath Đường dẫn file WAV trên SPIFFS
     *
     * @return ESP_OK nếu file được queue
     */
    esp_err_t ws_client_send_file(const char *filepath);

    /**
     * @brief Ngắt kết nối và giải phóng tài nguyên.
     */
    void ws_client_disconnect(void);

#ifdef __cplusplus
}
#endif
