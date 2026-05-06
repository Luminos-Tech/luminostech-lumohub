# OLED Library v1.0

Tài liệu sử dụng thư viện `oled` cho Lumo by `LuminosTech`.

## Mục tiêu

Thư viện này dùng để điều khiển màn OLED I2C 128x64, phù hợp với module 1.3 inch địa chỉ `0x3C` mà bạn đang dùng.

Thư viện hiện hỗ trợ:

```bash
- khởi tạo OLED qua I2C
- clear / fill buffer
- vẽ pixel
- vẽ đường ngang / dọc
- vẽ hình chữ nhật viền
- vẽ ký tự font 5x7
- vẽ chuỗi text 5x7
- cập nhật buffer lên màn hình
```
---

## File trong thư viện

Thư viện gồm 2 file chính:

- `oled.h`
- `oled.c`

Ngoài ra `oled.c` đang dùng thêm font từ:

- `font5x7/font5x7.h`

---

## API công khai

Trong `oled.h` có các hàm sau:

```c
esp_err_t oled_begin(int sda_pin, int scl_pin, uint8_t i2c_addr);
void oled_clear(void);
void oled_fill(void);
void oled_update(void);

void oled_draw_pixel(int x, int y, bool color);
void oled_draw_hline(int x, int y, int w, bool color);
void oled_draw_vline(int x, int y, int h, bool color);
void oled_draw_rect(int x, int y, int w, int h, bool color);

void oled_draw_char_5x7(int x, int y, char c, bool color);
void oled_draw_text_5x7(int x, int y, const char *text, bool color);
```

Kích thước màn được khai báo sẵn:

```c
#define OLED_WIDTH 128
#define OLED_HEIGHT 64
```

---

## Ý nghĩa từng hàm

### `oled_begin(int sda_pin, int scl_pin, uint8_t i2c_addr)`

Khởi tạo bus I2C, add thiết bị OLED, gửi chuỗi lệnh init panel, clear buffer và update màn hình.

#### Tham số

- `sda_pin`: chân SDA
- `scl_pin`: chân SCL
- `i2c_addr`: địa chỉ I2C của màn, thường là `0x3C`

#### Giá trị trả về

- `ESP_OK`: thành công
- mã lỗi ESP-IDF khác nếu init I2C hoặc add device thất bại

#### Ví dụ

```c
ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));
```

---

### `oled_clear()`

Xóa toàn bộ buffer trong RAM về màu đen.

Lưu ý: hàm này chưa làm màn hình đổi ngay. Muốn màn đổi thật sự phải gọi thêm `oled_update()`.

#### Ví dụ

```c
oled_clear();
oled_update();
```

---

### `oled_fill()`

Điền toàn bộ buffer thành màu trắng.

#### Ví dụ

```c
oled_fill();
oled_update();
```

---

### `oled_update()`

Đẩy toàn bộ buffer hiện tại lên màn hình OLED.

Đây là hàm rất quan trọng. Mọi thứ bạn vẽ bằng `oled_draw_*` chỉ nằm trong RAM cho tới khi gọi `oled_update()`.

#### Ví dụ

```c
oled_clear();
oled_draw_text_5x7(10, 10, "HELLO", true);
oled_update();
```

---

### `oled_draw_pixel(int x, int y, bool color)`

Vẽ 1 pixel tại tọa độ `(x, y)`.

#### Tham số

- `x`: tọa độ ngang
- `y`: tọa độ dọc
- `color`: `true` = bật pixel, `false` = tắt pixel

#### Ví dụ

```c
oled_draw_pixel(10, 10, true);
```

---

### `oled_draw_hline(int x, int y, int w, bool color)`

Vẽ đường ngang.

#### Tham số

- `x`, `y`: điểm bắt đầu
- `w`: chiều dài
- `color`: bật hoặc tắt pixel

---

### `oled_draw_vline(int x, int y, int h, bool color)`

Vẽ đường dọc.

#### Tham số

- `x`, `y`: điểm bắt đầu
- `h`: chiều cao
- `color`: bật hoặc tắt pixel

---

### `oled_draw_rect(int x, int y, int w, int h, bool color)`

Vẽ hình chữ nhật viền.

#### Ví dụ

```c
oled_draw_rect(0, 0, 128, 64, true);
```

---

### `oled_draw_char_5x7(int x, int y, char c, bool color)`

Vẽ 1 ký tự dùng font 5x7.

Font được map từ `font5x7.h`.

#### Ví dụ

```c
oled_draw_char_5x7(10, 10, 'A', true);
```

---

### `oled_draw_text_5x7(int x, int y, const char *text, bool color)`

Vẽ cả chuỗi text bằng font 5x7.

Mỗi ký tự cách nhau 1 pixel, tức là mỗi ký tự chiếm 6 pixel ngang.

#### Ví dụ

```c
oled_draw_text_5x7(10, 20, "ESP32-S3", true);
```

---

## Màn hình được hỗ trợ trong bản hiện tại

Theo code hiện tại:

- kích thước: `128x64`
- giao tiếp: `I2C`
- địa chỉ thường dùng: `0x3C`
- init sequence đang nghiêng về `SH1106` hoặc module OLED 1.3 inch tương thích

Nếu module của bạn là SSD1306 mà hiển thị lệch hoặc ngược, có thể cần chỉnh lại lệnh init.

---

## Kết nối phần cứng đề xuất

Với ESP32-S3 của bạn:

```text
OLED      ESP32-S3
VCC    -> 3V3
GND    -> GND
SDA    -> GPIO11
SCL    -> GPIO12
```

Khởi tạo tương ứng:

```c
ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));
```

---

## Cách dùng tối thiểu

### Ví dụ đơn giản nhất

```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "oled/oled.h"

static const char *TAG = "MAIN";

void app_main(void)
{
    ESP_LOGI(TAG, "Start OLED...");

    ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));

    oled_clear();
    oled_draw_rect(0, 0, 128, 64, true);
    oled_draw_text_5x7(30, 20, "TEST 123", true);
    oled_draw_text_5x7(24, 36, "ESP32 S3", true);
    oled_update();

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
```

---

## Luồng làm việc đúng

Thư viện này làm việc theo kiểu buffer.

### Trình tự chuẩn:

1. `oled_begin(...)`
2. `oled_clear()` hoặc `oled_fill()`
3. gọi các hàm vẽ như `oled_draw_pixel`, `oled_draw_rect`, `oled_draw_text_5x7`
4. `oled_update()` để hiện nội dung lên màn

Ví dụ:

```c
oled_clear();
oled_draw_text_5x7(10, 10, "Hello", true);
oled_update();
```

Nếu quên `oled_update()` thì màn hình sẽ không đổi.

---

## Font hiện có

Trong `oled.c`, hàm `get_char_bitmap()` đang hỗ trợ:

- số `0-9`
- chữ hoa `A-Z`
- chữ thường `a-z`
- một số ký tự đặc biệt như:
  - `.` `,` `:` `;`
  - `-` `_`
  - `/` `\\`
  - `!` `?`
  - `(` `)`
  - `+` `=`
  - dấu cách

Nếu ký tự không có trong bảng font, thư viện sẽ trả về `FONT_SPACE` và hiển thị như khoảng trắng.

---

## Cấu trúc thư mục đề xuất

Ví dụ cấu trúc bạn đang dùng:

```text
main/
├── CMakeLists.txt
├── Lumo-LuminosTech.c
└── oled/
    ├── oled.c
    ├── oled.h
    └── font5x7/
        └── font5x7.h
```

---

## Include đúng cách

### Trong `Lumo-LuminosTech.c`

```c
#include "oled/oled.h"
```

### Trong `oled.c`

```c
#include "oled.h"
#include "font5x7/font5x7.h"
```

---

## `main/CMakeLists.txt`

Nếu thư mục của bạn là như trên thì `main/CMakeLists.txt` nên là:

```cmake
idf_component_register(
    SRCS "Lumo-LuminosTech.c" "oled/oled.c"
    INCLUDE_DIRS "." "oled" "oled/font5x7"
    REQUIRES esp_driver_i2c
)
```

Nếu bạn chuyển `font5x7.h` lên cùng cấp với `oled.c` và `oled.h` thì có thể rút gọn hơn.

---

## Ví dụ test nhanh

### Test full sáng rồi clear

```c
oled_fill();
oled_update();
vTaskDelay(pdMS_TO_TICKS(1000));

oled_clear();
oled_update();
```

### Test khung + text

```c
oled_clear();
oled_draw_rect(0, 0, 128, 64, true);
oled_draw_text_5x7(36, 28, "HELLO", true);
oled_update();
```

### Test nhiều dòng

```c
oled_clear();
oled_draw_text_5x7(8, 12, "Hello, esp32!", true);
oled_draw_text_5x7(8, 28, "temp: 25.5C", true);
oled_draw_text_5x7(8, 44, "wifi_ok? yes", true);
oled_update();
```

---

## Các lỗi thường gặp

### 1. Màn không sáng gì

Kiểm tra:

- có cấp `3V3` chưa
- `GND` đúng chưa
- `SDA/SCL` đúng chân chưa
- địa chỉ I2C có đúng `0x3C` không

Nên chạy I2C scanner trước để xác nhận thiết bị xuất hiện ở `0x3C`.

---

### 2. Build lỗi `driver/i2c_master.h: No such file or directory`

Do `main/CMakeLists.txt` chưa thêm dependency đúng.

Cần có:

```cmake
REQUIRES esp_driver_i2c
```

---

### 3. Chữ bị ngược hoặc màn bị lật

Trong `oled_init_panel()` hiện tại đang dùng:

```c
oled_send_cmd(0xA1);
oled_send_cmd(0xC0);
```

Nếu module khác hướng, có thể thử các cặp:

```c
0xA0 / 0xC0
0xA1 / 0xC0
0xA0 / 0xC8
0xA1 / 0xC8
```

---

### 4. Đổi text mà chỉ hiện một số chữ

Nguyên nhân là ký tự đó chưa có trong `font5x7.h` hoặc chưa được map trong `get_char_bitmap()`.

Bản hiện tại đã hỗ trợ khá nhiều ký tự cơ bản, nhưng nếu muốn thêm mới thì cần:

1. thêm bitmap trong `font5x7.h`
2. thêm `case` trong `get_char_bitmap()`

---

### 5. Vẽ rồi mà màn không đổi

Do quên gọi:

```c
oled_update();
```

---

## Giới hạn của bản v1.0

Bản hiện tại chưa có:

- vẽ bitmap ảnh
- vẽ circle
- fill rect tối ưu riêng
- font Unicode
- tiếng Việt có dấu
- hỗ trợ nhiều loại panel khác nhau bằng config
- API set contrast / invert / rotate riêng

Nó phù hợp nhất cho:

- debug text
- hiển thị trạng thái đơn giản
- menu cơ bản
- project embedded gọn nhẹ

---

## Gợi ý nâng cấp cho v1.1

Nếu muốn nâng bản tiếp theo, nên thêm:

- `oled_fill_rect()`
- `oled_draw_bitmap()`
- `oled_set_contrast(uint8_t value)`
- `oled_set_rotation(...)`
- bảng font ASCII đầy đủ hơn
- tách init cho SH1106 và SSD1306

---

## Tóm tắt cực ngắn

Cách dùng cơ bản nhất:

```c
ESP_ERROR_CHECK(oled_begin(11, 12, 0x3C));
oled_clear();
oled_draw_text_5x7(10, 10, "HELLO", true);
oled_update();
```

Đó là quy trình chuẩn của thư viện OLED v1.0.

