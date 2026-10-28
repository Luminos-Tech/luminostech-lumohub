# Căn cứ cho sơ đồ luồng phần cứng LUMO

Ngày đối chiếu: **29/10/2026, Asia/Saigon**. Phạm vi là working tree của `vietfuture`, bao gồm các thay đổi chưa commit đang có khi đọc mã nguồn.

**Bản dùng để chèn báo cáo một trang A4:** `LUMO_HARDWARE_FLOW_A4.png`, khổ dọc 2.480 × 3.508 pixel, 300 DPI. Bản này rút gọn thành các bước có mũi tên, dùng chữ nội dung khoảng 10,6–11,5 pt khi in đúng khổ A4. File `LUMO_HARDWARE_FLOW_A4.svg` có kích thước vật lý 210 × 297 mm. Tạo lại bằng `python -X utf8 vietfuture/docs/hardware-flow/generate_a4_flow.py`.

Ảnh chính: `LUMO_HARDWARE_FLOW.png` — 4.400 × 3.400 pixel, metadata 300 DPI. Bản vector: `LUMO_HARDWARE_FLOW.svg`. Có thể chèn PNG vào báo cáo hoặc dùng SVG để phóng lớn, chỉnh sửa. Script `generate_hardware_flow.py` tạo lại cả hai và bản xem trước.

Sơ đồ mô tả chuyển động của người đeo, đường đi tín hiệu cảm biến và luồng xử lý/lệnh. Firmware được kiểm tra không có luồng điều khiển động cơ di chuyển robot. Đây là đối chiếu mã nguồn, chưa xác nhận phiên bản đã flash, dây nối thực tế hay hiệu năng trên thiết bị.

## Cấu hình build được dùng để đối chiếu

- [Band/main/CMakeLists.txt](../../lumo-vietfuture/Lumo-Band/main/CMakeLists.txt) đưa `src/main.c` và `src/mpu6050.c` vào build. Các module `src/lumo_ble.c`, `src/esp32_link.c` và UUID trong `include/lumo_band_config.h` không phải giao thức đang được entry point này sử dụng.
- [Hub/main/CMakeLists.txt](../../lumo-vietfuture/Lumo-LuminosTech/main/CMakeLists.txt) đặt mặc định `MODE=full`; `build/CMakeCache.txt` tại thời điểm đọc cũng có `MODE:STRING=full`.
- `sdkconfig` của Hub xác định `esp32s3`; `sdkconfig` và `sdkconfig.defaults` của Band xác định `esp32c3`.
- [Hub/main/Lumo-LuminosTech.c](../../lumo-vietfuture/Lumo-LuminosTech/main/Lumo-LuminosTech.c), dòng 10–20: bật storage, microphone, button, audio, network, server_events; tắt voice_assistant và microphone_record_test. `app_main()` khởi động BLE central rồi runtime.
- [Hub/main/lumo_version.h](../../lumo-vietfuture/Lumo-LuminosTech/main/lumo_version.h): `v0.5.10-registration-reconnect`.

## A. Cảm biến → Band → BLE → Hub

| Nội dung trên hình | Căn cứ trong code |
| --- | --- |
| MPU6050, SDA=3, SCL=4, địa chỉ 0x68, I²C 400 kHz | [Band/src/mpu6050.c](../../lumo-vietfuture/Lumo-Band/src/mpu6050.c), macro dòng 14–21 và `mpu6050_start()` |
| Đọc 3 trục gia tốc, 3 trục gyro, mỗi 100 ms | Cùng file, `mpu6050_task()`, từ dòng 309; đọc 14 byte từ thanh ghi 0x3B, bỏ qua 2 byte nhiệt độ |
| Độ lớn vector và peak khoảng 1 giây | Cùng file, `vector_magnitude()`, `s_accel_window` với 10 mẫu và `mpu6050_task()` |
| Tên BLE `LUMO-TEST-C3`, payload v0x02, 12 byte | [Band/src/main.c](../../lumo-vietfuture/Lumo-Band/src/main.c), dòng 24–44 |
| Chu kỳ thường 1 giây; ngã: gửi ở vòng task đầu thấy state=3, rồi mỗi 5 giây | Cùng file, `sample_task()`, từ dòng 281; task kiểm tra khoảng mỗi 100 ms |
| Chỉ Notify khi kết nối và đã subscribe; mất kết nối thì quảng bá lại | Cùng file, `gap_event()` và `sample_task()` |
| Hub scan theo tên, connect, tìm service/characteristic/CCCD rồi đăng ký Notify | [Hub/main/ble/lumo_band_central.c](../../lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_central.c) |
| Payload được giải mã và đưa vào shared state tại Hub | Cùng file, `BLE_GAP_EVENT_NOTIFY_RX` gọi `band_state_update()` |

Giao thức BLE đang dùng:

- Service: `12345678-1234-5678-1234-56789abcdef0`.
- Characteristic READ/NOTIFY: `12345678-1234-5678-1234-56789abcdef1`.
- Offset byte: `0=version`, `1=state`, `2..3=magnitude_x100`, `4..5=peak1s_x100`, `6=heart_rate`, `7..8=steps`, `9=battery`, `10..11=reserved`.
- State: `0=IDLE`, `1=MOVE`, `2=IMPACT_WAIT`, `3=FALL_CONFIRMED`, `4=SENSOR_OFFLINE`. `RECOVERED` nội bộ được ánh xạ sang MOVE khi đóng gói.

Các trường nhịp tim, số bước và pin **do `esp_random()` tạo** trong `sample_task()`: lần lượt 60–100, 1.000–9.999 và 50–100. Chúng không phải phép đo từ cảm biến tương ứng. `mpu6050_start()` còn TODO ước lượng bước chân.

## B. Phát hiện ngã trên Band và cảnh báo trên Hub

[Band/src/mpu6050.c](../../lumo-vietfuture/Lumo-Band/src/mpu6050.c), macro dòng 23–33 và `update_fall_state()` từ dòng 164:

1. Trong IDLE, `|a| >= 4.0 g` đưa state sang IMPACT_WAIT.
2. `moving = (|a| > 1.5 g) OR (|gyro| > 50°/s)`.
3. `still = (0.85 <= |a| <= 1.15 g) AND (|gyro| < 10°/s)`.
4. Trong IMPACT_WAIT, 3 mẫu moving liên tiếp đưa state sang RECOVERED; vòng lấy mẫu tiếp theo trở về IDLE.
5. 5.000 ms still liên tục đưa state sang FALL_CONFIRMED. Bộ đếm tăng 100 ms mỗi mẫu hợp lệ, nên đây là thời gian danh định theo code.
6. Nếu vẫn ở IMPACT_WAIT sau 10.000 ms kể từ impact thì trở về IDLE.
7. Trong FALL_CONFIRMED, 5 mẫu moving liên tiếp xóa trạng thái ngã.
8. Đọc cảm biến thất bại đặt SENSOR_OFFLINE. Nhánh xử lý lỗi không có cơ chế gửi HTTP trực tiếp từ Band.

[Hub/main/ble/lumo_band_state.h](../../lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_state.h), dòng 65 và 92–94:

- `THRESHOLD_PEAK_FALL=500`, trường peak được nhân 100, nên ngưỡng **5 g**.
- Classifier bổ sung: cửa sổ 6.000 ms, still 3.000 ms, `magnitude_x100 < 105`, tương ứng `|a| < 1.05 g`. Đây là điều kiện riêng của Hub, không thay thế máy trạng thái trên Band.
- Chú thích ở nhiều vị trí vẫn ghi 8 g, 6 g, 30 giây hoặc beep liên tục. Hình dùng giá trị macro và nhánh thực thi hiện tại.

[Hub/main/ble/lumo_band_state.c](../../lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_state.c), `band_state_update()` và `band_evaluate_alerts()`:

- Nhận state/HR/steps/magnitude/peak và cập nhật thời gian nhận.
- Kiểm tra offline, ưu tiên trạng thái ngã và các cảnh báo khác trước nhánh HIGH_ACTIVITY.
- Bộ classifier có nhánh kết thúc theo timeout hoặc chuyển động mạnh sau impact; vì vậy không thể diễn giải “peak ≥ 5 g” thành cam kết mọi mẫu như vậy đều phát âm thanh.
- Trường battery được truyền vào `band_state_update()` nhưng hàm hiện chưa gán vào `g_band_state.battery`. Không coi đây là giám sát pin hoàn chỉnh.

[Hub/main/lumo_runtime.c](../../lumo-vietfuture/Lumo-LuminosTech/main/lumo_runtime.c), `band_alert_audio()` từ dòng 105:

- FALL_CONFIRMED và FALL_SUSPECT đều `return` ngay, không có lệnh phát loa hay gửi push trong handler này.
- Khi evaluator trả HIGH_ACTIVITY: gọi `audio_play("/spiffs/risk.wav")` 2 lần theo thứ tự; sau đó tạo task gửi push cho `user_id=1`. Phát được hay không còn phụ thuộc file WAV, audio/storage, trạng thái loa và kết quả task.
- Không mô tả hiện trạng thành một luồng “ngã → cứu hộ” hoặc “ngã → tự động báo gia đình” đã hoàn thiện.
- `band_alert_tick()` chạy trong vòng runtime, sau xử lý mic và trước `vTaskDelay(200 ms)`. Đây không phải chu kỳ cảnh báo cố định 200 ms vì đọc mic và phát âm thanh có thể mất thời gian.

[Hub/main/http_api/http_api.c](../../lumo-vietfuture/Lumo-LuminosTech/main/http_api/http_api.c), `http_api_send_push_alert()`:

- Gọi HTTP gửi push 3 lần, sau mỗi lần delay 200 ms, kể cả khi lần trước thành công.
- Đây là 3 yêu cầu độc lập, có thể tạo nhiều bản ghi thông báo. Khoảng cách thực tế bao gồm cả thời gian request.
- Wrapper hiện trả ESP_OK sau vòng lặp mà không tổng hợp lỗi từng request; sơ đồ chỉ mô tả nỗ lực gửi, không bảo đảm trình duyệt nhận.

## C. Nút nhấn và điều khiển loa từ web

| Luồng | Nguồn |
| --- | --- |
| Nút GPIO42 active LOW, debounce 5 ms | [Hub/main/lumo_runtime.c](../../lumo-vietfuture/Lumo-LuminosTech/main/lumo_runtime.c), macro GPIO và `initialize_enabled_features()`; [button/button.c](../../lumo-vietfuture/Lumo-LuminosTech/main/button/button.c), `button_update()` |
| Nhấn rồi thả tạo click, task kiểm tra mỗi 10 ms | Cùng hai file, `button_poll_task()` và `button_is_clicked()` |
| Queue RAM tối đa 32 sự kiện | `init_server_events()` và `handle_button_press()` trong runtime |
| Chờ Wi-Fi/giờ hợp lệ, gửi push rồi event-buttons | `send_button_event_iso8601()` trong runtime |
| Check-in được gắn chủ sở hữu theo mã Hub, lưu event và last_checkin_at | [backend/app/routes/event_buttons.py](../../backend-vietfuture/app/routes/event_buttons.py), `record_button_click()`; [crud/event_button.py](../../backend-vietfuture/app/crud/event_button.py) |
| Push lưu notification, realtime và Web Push | [backend/app/routes/push.py](../../backend-vietfuture/app/routes/push.py), `send_push()`, từ dòng 162; Web Push cần subscription và cấu hình VAPID |
| REST điều khiển loa cần JWT và chủ sở hữu/admin | [backend/app/routes/devices.py](../../backend-vietfuture/app/routes/devices.py), `require_control_device()` và `send_device_command()` |
| Firmware nhận command và trả command_result | [Hub/main/device_control/device_control.c](../../lumo-vietfuture/Lumo-LuminosTech/main/device_control/device_control.c), `handle_message()`, `sound_task()`, `send_result()` |
| Web đợi kết quả trả về trước khi báo hoàn thành | [DeviceAudioControl.tsx](../../frontend-web-vietfuture/src/components/devices/DeviceAudioControl.tsx), `send()` |
| Backend handshake và chuyển ACK tới lệnh đang chờ | [backend/app/websocket/routes.py](../../backend-vietfuture/app/websocket/routes.py), `lumo_websocket()`; [websocket/manager.py](../../backend-vietfuture/app/websocket/manager.py) |

Các âm thanh được ánh xạ trong `sound_path()`: `beep → /spiffs/beep.wav`, `greeting → /spiffs/LumoHello.wav`, `checkin → /spiffs/checkLife.wav`. `stop_audio` gọi `audio_stop()` và trả `stopped`; phát thành công trả `completed`. Các trạng thái lỗi/bận cũng có phản hồi.

Chú ý định danh: `0001` là mã Hub trong firmware, `{id}` của REST điều khiển là khóa chính bản ghi thiết bị. Push hiện dùng người nhận demo `user_id=1`, trong khi check-in được gắn theo chủ sở hữu Hub trong database; hai luồng không được đồng nhất.

## Các giới hạn được ghi trên hình

- `voice_assistant=false`; `start_voice_interaction()` return ngay và phần code cũ nằm trong `#if 0`. Không vẽ STT/LLM/TTS thành luồng đang hoạt động của Hub này.
- Mic được khởi tạo 16 kHz, frame 100 ms; runtime đọc và tính mức âm. Phần in log mức mic đã bị comment. Không suy ra có kích hoạt hội thoại từ đoạn comment về voice activation.
- OLED không có trong build full hiện tại.
- Mã đang dùng Wi-Fi; không có luồng 4G trong sơ đồ.
- Backend có PATCH telemetry, nhưng các file firmware đang tham gia build chưa có lệnh gọi endpoint đó hoặc luồng đẩy dữ liệu chuyển động tương đương. API tồn tại chưa đồng nghĩa Band telemetry đã lên dashboard.
- Working tree hiện có `device_logs` qua WebSocket cho các sự kiện Hub như kết nối, HTTP, nút, loa và heartbeat. Đây là log vận hành, không phải stream mẫu MPU6050 lên dashboard. Hình tập trung các luồng chức năng phần cứng chính.
- Queue nút đầy thì click không được gửi. Không Wi-Fi hoặc chưa có giờ hợp lệ thì worker bỏ qua sự kiện; không có queue bền vững để gửi lại sau khi mất điện.
- Không kiểm tra phần cứng, flash firmware, gọi API production hay gửi thông báo khi tạo tài liệu này.

## Tái tạo và kiểm tra

Chạy từ root workspace:

```powershell
python -X utf8 vietfuture/docs/hardware-flow/generate_hardware_flow.py
```

Script kiểm tra biên chữ trên canvas và phần thân 21 khối nội dung, xuất PNG/SVG/bản xem trước, đồng thời ghi SHA-256 các file nguồn vào `source_manifest.json`. Cần đọc lại các nguồn nếu thay đổi firmware/backend; chạy lại script chỉ tái xuất nội dung đã được đối chiếu, không tự cập nhật ngữ nghĩa sơ đồ.
