# Điều khiển loa LUMO Hub từ web

Luồng hoạt động:

```text
Cài đặt → Thiết bị → Phát trên Hub
  → REST API có JWT, kiểm tra chủ sở hữu hoặc admin
  → WebSocket của Hub thật
  → phát WAV trên SPIFFS
  → command_result
  → giao diện báo kết quả
```

Các âm thanh: `beep` → `/spiffs/beep.wav`, `greeting` →
`/spiffs/LumoHello.wav`, `checkin` → `/spiffs/checkLife.wav`.
Không nhận đường dẫn file hoặc URL do trình duyệt cung cấp.

## Thêm thiết bị bằng mã số

Trong **Cài đặt → Thiết bị → Thêm thiết bị**, lựa chọn mặc định là **Nhập mã số**.
Nhập `0001` để thêm Hub trong bản firmware hiện tại; mã được đặt tại
`#define DEVICE_CODE "0001"` trong `main/lumo_runtime.c`.
Có thể nhập `1`, web và backend sẽ chuẩn hóa thành chuỗi bốn chữ số `0001`.
Đây là mã phần cứng `device_id`; khóa chính `id` trong database được cấp riêng.
Camera chỉ được khởi động khi người dùng chọn **Quét QR**.

## API

- `GET /api/v1/devices/{device_pk}/control`: trạng thái kết nối thực tế,
  khả năng điều khiển loa và phiên bản firmware. `is_active` trong dữ liệu
  thiết bị không được dùng thay cho trạng thái online.
- `POST /api/v1/devices/{device_pk}/commands`:

```json
{"action": "play_sound", "sound": "beep"}
```

Hoặc `{"action":"stop_audio"}`. Trả `200` sau khi Hub xác nhận;
`409` nếu offline, bận, thiết bị bị vô hiệu hóa hoặc firmware chưa hỗ trợ;
`502` nếu firmware báo lỗi; `504` nếu không có xác nhận sau 20 giây.
Timeout không chứng minh lệnh chưa chạy, nên kiểm tra thiết bị trước khi gửi lại.
Mỗi lệnh được ghi vào system log.

Trạng thái `stopped` xác nhận Hub đã nhận yêu cầu dừng. Lệnh phát đang chờ
sẽ bị hủy nếu nhận lệnh dừng; lệnh phát đã chạy sẽ thoát ở vòng ghi I2S tiếp theo.
Các cảnh báo khác có thể tiếp tục kích hoạt theo cảm biến.

## WebSocket thiết bị

Firmware v0.5.9 kết nối `/ws/lumo?device_id=0001` và gửi:

```json
{"type":"hello","device_id":"0001","firmware_version":"v0.5.9-web-audio-control","capabilities":["audio_control_v1"]}
```

Backend chỉ đăng ký thiết bị sau handshake và kiểm tra mã thiết bị đang hoạt động.
Handshake này kế thừa định danh bằng mã thiết bị của bản prototype; chưa có khóa
xác thực riêng cho từng Hub. Quyền gửi lệnh từ web được kiểm tra bằng JWT.
Không mở thêm cổng hay bỏ qua xác thực REST.

Backend trả `{"type":"ready","device_id":"0001"}`. Firmware gửi text `ping`
mỗi 25 giây. Mất Wi-Fi/WebSocket sẽ tự kết nối lại. Không lưu lệnh điều khiển
để tự phát lại sau khi kết nối lại.

Backend gửi:

```json
{"type":"command","request_id":"0123456789abcdef0123456789abcdef","action":"play_sound","sound":"beep"}
```

Firmware trả `type="command_result"` cùng `request_id` và trạng thái
`completed`, `stopped`, `busy` hoặc `error`. Xác nhận từ kết nối cũ hoặc một
thiết bị khác không được dùng để hoàn tất lệnh.

Web không kết nối vào `/ws/lumo` để giả lập thiết bị. Trang kiểm thử cũ đã được
thay bằng điều khiển loa thực; TTS tự do từ trình duyệt chưa được triển khai cho
firmware mới. Các API giọng nói hiện hữu vẫn giữ nguyên.

## Áp dụng

1. Đưa thay đổi backend/frontend lên đúng máy chủ phục vụ web.
2. Đảm bảo reverse proxy chuyển tiếp WebSocket tại `/ws/lumo`.
3. Chạy một backend worker: registry WebSocket và các lệnh đang chờ nằm trong RAM.
   Muốn chạy nhiều worker cần thêm message broker/registry dùng chung.
4. Build firmware bằng ESP-IDF 5.5: `idf.py -DMODE=full build`.
5. Flash ESP32-S3 rồi xem monitor. Log cần có
   `Server ready; web audio control is online`.
6. Mở `/settings/devices`, chờ “Hub đang kết nối”, bấm “Phát trên Hub”.

Kiểm tra local:

```powershell
.\.venv\Scripts\python.exe -X utf8 -m unittest discover -s tests -v
```

Các test mô phỏng firmware qua WebSocket để kiểm tra quyền, trạng thái offline,
âm thanh không hợp lệ, xác nhận lệnh, lỗi loa và thay thế kết nối.
Chúng không thay cho việc nghe thử trên phần cứng.

## Xem log trực tiếp trên điện thoại (v0.5.11)

Mọi tài khoản đang hoạt động đã đăng nhập đều được xem log, kể cả tài khoản
không sở hữu Hub và không phải admin. Vào **Cài đặt → Thiết bị → Log thiết bị**,
chọn Hub rồi mở **Log trực tiếp**. Danh sách chọn log chỉ trả mã Hub và ID bản ghi,
không trả thông tin chủ sở hữu. Quyền điều khiển phần cứng vẫn dành cho chủ Hub/admin.
Không cần máy tính nối USB hay mở serial monitor. Bảng log cập nhật mỗi 2 giây
khi đang mở, có lọc mức I/W/E, tạm dừng, tiếp tục, tự cuộn và xóa màn hình.
Xóa màn hình chỉ xóa phần đang xem trên trình duyệt.

Firmware gửi các sự kiện kỹ thuật được chọn rõ ràng: đăng ký/kết nối WebSocket,
Wi-Fi, nút bấm, kết quả gọi API, phát/dừng loa và heartbeat mỗi 30 giây.
Không chuyển tiếp toàn bộ serial output, mật khẩu, tên Wi-Fi, nội dung âm thanh
hay HR/bước chân/pin thử nghiệm. Chẩn đoán MPU ở phần dưới chỉ gồm dữ liệu chuyển động.
Hàng đợi Hub giữ tối đa 24 sự kiện; log là best-effort
và có thể mất khi mất mạng, đầy hàng đợi hoặc khởi động lại.

Sau handshake với capability `device_logs_v1`, Hub gửi:

```json
{"type":"device_logs","entries":[{"level":"I","tag":"BUTTON","message":"Physical button pressed","uptime_ms":1234}]}
```

Backend chỉ nhận log từ socket hiện tại của Hub đó, giới hạn 10 dòng/giây,
320 ký tự/dòng. Bộ đệm RAM giữ 200 dòng/Hub trong 15 phút, tối đa 64 Hub;
không ghi log này vào database. Backend khởi động lại sẽ làm mất bộ đệm.
Các chuỗi có dấu hiệu chứa thông tin xác thực được che thêm ở backend.

Hub v0.5.12 + Band v0.3.0 bổ sung dòng `MPU6050` khoảng mỗi 2 giây:
gia tốc ba trục (g), gyro ba trục (độ/giây), độ lớn gia tốc, peak, số mẫu và
tuổi dữ liệu. Mất BLE, thiếu mẫu hoặc MPU báo offline được ghi riêng; dữ liệu
cũ không được gắn nhãn đang hoạt động. Không gửi HR/bước chân/pin thử nghiệm
vào dòng chẩn đoán MPU. Xem `Lumo-Band/doc/BLE_PROTOCOL.md` cho payload BLE.

Điện thoại đọc `GET /api/v1/devices/{device_pk}/logs?after=0&limit=100` qua JWT.
API yêu cầu đăng nhập nhưng không kiểm tra vai trò admin/quyền sở hữu; trả `Cache-Control: no-store`, cursor, stream_id,
trạng thái Hub và các dòng log có thời gian UTC+7. Sau lần đầu, dùng cursor
làm `after` để chỉ lấy dòng mới. `stream_id` đổi khi backend khởi động lại.

Cần cập nhật cả backend, frontend trên tên miền chính và firmware v0.5.11.
Nếu backend còn cũ, bảng sẽ báo cần cập nhật backend; điều khiển loa hiện có
vẫn hoạt động độc lập với phần log.

`DEVICE_LOGS_ENABLED=true` là cấu hình mặc định. Có thể đặt thành `false`
và khởi động lại backend nếu sau này muốn tạm tắt hẳn tính năng.
