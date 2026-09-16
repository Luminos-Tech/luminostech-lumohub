# Audio Player Library

Tài liệu sử dụng thư viện `audio_player` cho ESP32-S3 + MAX98357A.

## Mục đích

Thư viện này dùng để:

- khởi tạo output âm thanh I2S
- đọc file WAV từ filesystem
- phát file đó ra loa qua MAX98357A

Thư viện hiện hỗ trợ:

- WAV
- PCM
- 16-bit
- mono hoặc stereo

Không hỗ trợ:

- MP3
- M4A
- FLAC
- WAV 24-bit
- WAV float
- ADPCM

---

## API

Trong `audio_player.h` có 2 hàm chính:

```c
esp_err_t audio_init(int bclk_gpio, int lrck_gpio, int dout_gpio);
esp_err_t audio_play(const char *filepath);
```

### `audio_init(int bclk_gpio, int lrck_gpio, int dout_gpio)`

Khởi tạo cấu hình chân I2S cho loa.

#### Tham số

- `bclk_gpio`: chân BCLK
- `lrck_gpio`: chân LRCK / LRC / WS
- `dout_gpio`: chân dữ liệu audio từ ESP32 sang MAX98357A

#### Giá trị trả về

- `ESP_OK`: thành công
- `ESP_ERR_INVALID_ARG`: tham số không hợp lệ

#### Ví dụ

```c
ESP_ERROR_CHECK(audio_init(5, 4, 6));
```

---

### `audio_play(const char *filepath)`

Phát một file WAV từ filesystem.

#### Tham số

- `filepath`: đường dẫn file, ví dụ `"/spiffs/sound.wav"`

#### Giá trị trả về

- `ESP_OK`: phát thành công
- `ESP_ERR_INVALID_ARG`: `filepath == NULL`
- `ESP_ERR_NOT_FOUND`: không mở được file
- `ESP_ERR_NOT_SUPPORTED`: file WAV không đúng format hỗ trợ
- `ESP_FAIL`: lỗi parse, seek, read, hoặc lỗi runtime khác

#### Ví dụ

```c
esp_err_t ret = audio_play("/spiffs/sound.wav");
if (ret != ESP_OK) {
    ESP_LOGE("MAIN", "audio_play failed: %s", esp_err_to_name(ret));
}
```

---

## Cách hoạt động

### `audio_init(...)`

Hàm này chỉ:

- lưu cấu hình chân I2S
- đánh dấu module audio đã sẵn sàng

Nó chưa phát âm thanh ngay.

### `audio_play(...)`

Hàm này sẽ:

1. mở file WAV
2. parse header và các chunk cần thiết
3. lấy ra:
   - `audio_format`
   - `num_channels`
   - `sample_rate`
   - `bits_per_sample`
   - `data_offset`
   - `data_size`
4. khởi tạo lại I2S theo `sample_rate` của file
5. đọc data audio trong file
6. nếu file mono thì nhân đôi ra stereo
7. ghi dữ liệu ra I2S để phát qua loa

---

## Format file được hỗ trợ

File hợp lệ phải có các điều kiện sau:

- `RIFF/WAVE`
- PCM (`audio_format = 1`)
- `16-bit`
- `mono` hoặc `stereo`

File nên chuẩn bị theo format này:

```bash
ffmpeg -i input.mp3 -ac 1 -ar 16000 -sample_fmt s16 sound.wav
```

Ý nghĩa:

- `-ac 1`: mono
- `-ar 16000`: 16 kHz
- `-sample_fmt s16`: PCM 16-bit

---

## Nối dây phần cứng

### MAX98357A ↔ ESP32-S3

Ví dụ mapping đang dùng:

```text
MAX98357A   ESP32-S3
VIN      -> 5V
GND      -> GND
LRC      -> GPIO4
BCLK     -> GPIO5
DIN      -> GPIO6
SD       -> 3V3
GAIN     -> để hở
```

Loa:

```text
SPK+ -> loa +
SPK- -> loa -
```

Nếu gọi:

```c
audio_init(5, 4, 6);
```

thì tương ứng là:

- `BCLK = GPIO5`
- `LRCK = GPIO4`
- `DOUT = GPIO6`

---

## Cách dùng tối thiểu

### Bước 1: mount SPIFFS

```c
#include "esp_spiffs.h"

static void init_spiffs(void)
{
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = NULL,
        .max_files = 5,
        .format_if_mount_failed = true,
    };

    ESP_ERROR_CHECK(esp_vfs_spiffs_register(&conf));
}
```

### Bước 2: khởi tạo audio

```c
ESP_ERROR_CHECK(audio_init(5, 4, 6));
```

### Bước 3: phát file

```c
esp_err_t ret = audio_play("/spiffs/sound.wav");
if (ret != ESP_OK) {
    ESP_LOGE("MAIN", "audio_play failed: %s", esp_err_to_name(ret));
}
```

---

## Ví dụ đầy đủ

```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_spiffs.h"
#include "audio/audio_player.h"

static const char *TAG = "MAIN";

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

void app_main(void)
{
    init_spiffs();
    ESP_ERROR_CHECK(audio_init(5, 4, 6));

    while (1)
    {
        esp_err_t ret = audio_play("/spiffs/sound.wav");
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "audio_play failed: %s", esp_err_to_name(ret));
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
```

---

## CMakeLists

Nếu cấu trúc thư mục là:

```text
main/
├── Lumo-LuminosTech.c
└── audio/
    ├── audio_player.c
    └── audio_player.h
```

thì `main/CMakeLists.txt` nên là:

```cmake
idf_component_register(
    SRCS "Lumo-LuminosTech.c" "audio/audio_player.c"
    INCLUDE_DIRS "." "audio"
    REQUIRES esp_driver_i2s spiffs
)
```

---

## Các lỗi thường gặp

### `Cannot open file`

Nguyên nhân thường là:

- file không tồn tại
- path sai
- SPIFFS chưa mount

Ví dụ path đúng:

```c
audio_play("/spiffs/sound.wav");
```

---

### `Not a valid WAV file`

Nguyên nhân:

- file không phải WAV chuẩn
- header bị lỗi

---

### `Only PCM WAV supported`

Nguyên nhân:

- file WAV không phải PCM

---

### `Only 16-bit WAV supported`

Nguyên nhân:

- file là 24-bit hoặc float

---

### `Only mono/stereo supported`

Nguyên nhân:

- file có số channel không được hỗ trợ

---

### `audio_play failed: ESP_FAIL`

Nguyên nhân có thể là:

- parse chunk lỗi
- `data` chunk lỗi
- file WAV bị hỏng
- seek/read lỗi

Khi debug, nên dùng:

```c
esp_err_t ret = audio_play("/spiffs/sound.wav");
if (ret != ESP_OK) {
    ESP_LOGE(TAG, "audio_play failed: %s", esp_err_to_name(ret));
}
```

Thay vì:

```c
ESP_ERROR_CHECK(audio_play("/spiffs/sound.wav"));
```

Vì `ESP_ERROR_CHECK` sẽ làm board reset ngay khi gặp lỗi.

---

## Ghi chú kỹ thuật

- Thư viện sẽ khởi tạo lại I2S theo `sample_rate` của file WAV mỗi lần phát.
- Nếu file là mono, thư viện tự nhân đôi sample thành stereo trước khi ghi ra I2S.
- Nếu file là stereo, thư viện ghi trực tiếp dữ liệu ra I2S.

---

## Tóm tắt cực ngắn

Chỉ cần nhớ 3 bước:

```c
init_spiffs();
audio_init(5, 4, 6);
audio_play("/spiffs/sound.wav");
```

Nếu 3 bước này đúng, thư viện sẽ phát file WAV từ SPIFFS ra loa MAX98357A.

