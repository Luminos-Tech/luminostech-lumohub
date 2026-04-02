# 💡 Lumo — LuminosTech

> Thiết bị IoT nhúng thông minh chạy trên ESP32, hỗ trợ điều khiển bằng nút nhấn, hiển thị OLED, thu âm microphone, phát âm thanh và giao tiếp server qua HTTPS — tất cả trong một firmware nhỏ gọn viết bằng C với ESP-IDF.

![Platform](https://img.shields.io/badge/platform-ESP32S3-blue)
![Framework](https://img.shields.io/badge/framework-ESP--IDF-red)
![Language](https://img.shields.io/badge/language-C++-lightgrey)
![License](https://img.shields.io/badge/license-Private-green)

---

## 🧩 Giới thiệu

**Lumo** là firmware cho thiết bị IoT nhúng dựa trên ESP32. Thiết bị kết nối WiFi, đồng bộ thời gian thực (NTP), lắng nghe tín hiệu từ nút nhấn, hiển thị trạng thái lên màn hình OLED và gửi sự kiện lên backend server tại `https://lumo.vanha2301.online/` thông qua HTTPS bảo mật (TLS/SSL).

---

## ✨ Tính năng

### 🖥️ Hiển thị OLED
- Giao tiếp qua I2C (SDA: GPIO 11, SCL: GPIO 12, địa chỉ `0x3C`)
- Hiển thị trạng thái WiFi, thông tin cấu hình và phản hồi nút nhấn theo thời gian thực
- Dùng font 5x7 pixel tùy chỉnh

### 🔘 Nút nhấn (Button)
- Kết nối GPIO 7, xử lý debounce phần mềm
- Phát hiện sự kiện **nhấn xuống** và **thả ra**
- Khi nhấn: gửi event `press` lên server, cập nhật màn hình OLED ngay lập tức

### 🎤 Microphone (I2S)
- Giao thức I2S: BCK GPIO 15, WS GPIO 16, DATA GPIO 17
- Sample rate 16.000 Hz, chu kỳ đọc 100ms mỗi frame
- Thu âm PCM 16-bit liên tục trong vòng lặp chính

### 🔊 Audio Player
- Phát âm thanh qua I2S (GPIO 5, 4, 6)
- Tích hợp trực tiếp vào luồng khởi động firmware

### 📡 WiFi & Web Portal
- Tự động kết nối lại WiFi từ cấu hình đã lưu (NVS Flash)
- Nếu không kết nối được: tự động mở **Access Point** `LUMO SETUP`
  - SSID: `LUMO SETUP`
  - Mật khẩu: `12345678`
  - Web portal cấu hình WiFi tại `192.168.4.1`

- Endpoint: `POST https://lumo.vanha2301.online/events/`
- HTTP task chạy ngầm độc lập, nhận lệnh qua **FreeRTOS Queue** (không block luồng chính)

### 🕐 Đồng bộ thời gian (SNTP)
- Tự động đồng bộ từ `time.google.com` sau khi kết nối WiFi
- Thử lại tối đa 15 lần (mỗi lần 2 giây)

### 💾 SPIFFS
- Lưu trữ file nội bộ (âm thanh, chứng chỉ, tài nguyên tĩnh)
- Tự động format nếu mount thất bại

---

## 🗂️ Cấu trúc dự án

```
Lumo-LuminosTech/
├── Lumo-LuminosTech.c      # App main — vòng lặp chính
├── CMakeLists.txt           # Cấu hình build ESP-IDF
├── certs/
│   └── server_cert.pem      # Chứng chỉ TLS cho HTTPS
├── audio/
│   └── audio_player.c/h     # Module phát âm thanh I2S
├── oled/
│   ├── oled.c/h             # Driver màn hình OLED I2C
│   └── font5x7/             # Font bitmap 5x7
├── button/
│   └── button.c/h           # Xử lý nút nhấn & debounce
├── wifi/
│   ├── wifi_manager.c/h     # Quản lý kết nối WiFi
│   └── web_portal.c/h       # AP mode & trang cấu hình
├── http_api/
│   └── http_api.c/h         # HTTP client helper
└── mic/
    └── mic.c/h              # Thu âm I2S microphone
```

---

## ⚙️ Hướng dẫn cài đặt

### Yêu cầu

| Công cụ | Phiên bản |
|---|---|
| ESP-IDF | >= v5.0 |
| CMake | >= 3.16 |
| Python | >= 3.8 |
| Chip | ESP32S3 (hoặc tương thích) |

### Các bước build & flash

```bash
# 1. Clone repository
git clone https://github.com/Luminos-Tech/LumoHub.git
cd LumoHub

# 2. Thiết lập môi trường ESP-IDF
. $IDF_PATH/export.sh

# 3. Cấu hình target chip
idf.py set-target esp32s3

# 4. (Tuỳ chọn) Cấu hình thêm
idf.py menuconfig

# 5. Build firmware
idf.py build

# 6. Flash lên thiết bị
idf.py -p /dev/ttyUSB0 flash monitor
```

### Cấu hình chứng chỉ TLS

Đặt file chứng chỉ server tại `certs/server_cert.pem`.  
File này được nhúng trực tiếp vào firmware lúc build (khai báo trong `CMakeLists.txt` qua `EMBED_TXTFILES`).

---

## 🚀 Hướng dẫn sử dụng

### Lần đầu sử dụng — Cấu hình WiFi

1. Cấp nguồn thiết bị
2. Màn hình OLED hiển thị hướng dẫn kết nối:
   ```
   Open: 192.168.4.1
   PASS: 12345678
   WIFI: LUMO SETUP
   ```
3. Kết nối điện thoại/máy tính vào WiFi `LUMO SETUP`
4. Truy cập `http://192.168.4.1` để nhập thông tin WiFi nhà
5. Thiết bị tự khởi động lại và kết nối WiFi

---

## 🤝 Đóng góp

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m "feat: mô tả thay đổi"`
4. Push & mở Pull Request

---

## 📄 License

Private License © 2026 LuminosTech

---

<p align="center">Made with ❤️ by <strong>LuminosTech</strong> · Powered by ESP-IDF & FreeRTOS</p>