# Hướng dẫn Sử dụng Chế độ Demo Giả Lập Tương Tác Ẩn (LUMO Presenter Demo Suite)

Hệ thống **Giả lập & Chế độ Demo Tương tác Ẩn (Interactive Demo Mode & Virtual Hardware Simulator)** đã được tích hợp hoàn chỉnh vào ứng dụng LUMO Hub. Tính năng này giúp bạn tự tin thuyết trình / pitch sản phẩm 100% trơn tru, hiển thị đầy đủ thông tin và dữ liệu sống động mà không phụ thuộc vào thiết bị phần cứng thật hay mạng backend.

---

## 🔑 1. Cách Kích Hoạt Bảng Điều Khiển Demo Ẩn (Presenter Console)

Bạn có thể kích hoạt bảng điều khiển bí mật bằng 3 cách:

1. **Phím tắt nhanh (Khuyên dùng khi thuyết trình trên Laptop):**
   - Nhấn **`Ctrl + Shift + D`** (hoặc `Alt + D`) ở bất kỳ trang nào.
2. **Click Logo Bí Mật (Khi demo trên màn hình cảm ứng / Tablet / Điện thoại):**
   - Nhấp **3 lần liên tiếp** vào **Logo LUMO** (ở góc trên Topbar hoặc thanh bên Sidebar).
3. **Nút Floating Mini:**
   - Một nút tròn nhỏ `Demo Console` mờ ở góc dưới bên phải màn hình, có thể bấm để mở/thu gọn.

---

## 🎯 2. Các Kịch Bản Demo 1 Chạm (One-Click Scenarios)

Trong tab **"Kịch bản Demo"** của bảng điều khiển:

| Kịch bản | Nút bấm | Hiệu ứng trên App khi Demo |
| :--- | :--- | :--- |
| 🚨 **Phát hiện Té Ngã (SOS)** | `1. Giả lập Té Ngã (SOS)` | • Kích hoạt màn hình cảnh báo đỏ nhấp nháy toàn màn hình.<br>• Phát âm thanh còi báo động khẩn cấp (Web Audio).<br>• Hiển thị vị trí GPS cụ bà (Phòng khách tầng 1) & người thân nhận tin.<br>• Đồng hồ đếm ngược 30s tự động chuyển tiếp 115.<br>• Nút "Gọi khẩn cấp" & "Tôi ổn (Hủy cảnh báo)". |
| 🔘 **Điểm Danh Buổi Sáng** | `2. Điểm danh sáng (Check-in)` | • Cập nhật trạng thái Dashboard sang **"Đã điểm danh lúc [giờ hiện tại]"**.<br>• Cột thứ trong tuần sáng xanh thành công.<br>• Bắn toast thông báo xác nhận an tâm. |
| 💊 **Nhắc Uống Thuốc** | `3. Nhắc nhở uống thuốc` | • Mở modal hiển thị đơn thuốc sáng (*Amlodipine 5mg, Glucosamine*).<br>• Phát lời nhắn thoại dặn dò của con gái bằng giọng nói AI tiếng Việt.<br>• Nút xác nhận "Cụ đã uống xong". |
| 🎙️ **Trợ Lý Giọng Nói AI** | `4. Trợ lý AI LUMO Companion` | • Mở giao diện Voice Assistant với **sóng âm 3D động** (Audio Waveform).<br>• Có sẵn 4 kịch bản mẫu: *Thời tiết, Lịch thuốc, Lời nhắn con cái, Kể chuyện vui*.<br>• Có thể gõ/nói trực tiếp để LUMO phản hồi giọng nói. |

---

## 🎛️ 3. Điều Khiển Phần Cứng Ảo Thời Gian Thực (Virtual Hardware Twin)

Trong tab **"Phần cứng ảo"**:
- **Kéo % Pin LUMO Band (0% - 100%):** Trực tiếp thay đổi chỉ số pin trên Dashboard và trang Quản lý Thiết bị.
- **Kéo Nhịp tim Sinh hiệu (55 - 135 BPM):** Hiển thị các dải sinh hiệu bình thường / vận động.
- **Kéo Vận động & Bước chân:** Thay đổi số phút vận động và bước chân hôm nay.
- **Trạng thái Mạng LUMO Hub:** Chuyển đổi linh hoạt giữa `4G LTE (eSIM)`, `Wi-Fi Nhà`, và `Offline`.

---

## 👤 4. Hồ Sơ Mẫu Chuẩn & Dữ Liệu Tự Động (Mock Persona)

Khi bật Demo Mode:
- Tự động hiển thị hồ sơ: **Cụ Nguyễn Thị Mai (78 tuổi - Ba Đình, Hà Nội)**, Người chăm sóc: **Anh Nguyễn Minh Trí (Con trai)**.
- Danh sách thông báo đầy đủ lịch sử điểm danh, nhắc thuốc, thời lượng pin.
- Trang **Thiết bị (`/settings/devices`)** hiển thị trọn bộ thiết bị Hub & Vòng Band sang trọng kèm mã QR ghép đôi.
- Trang **Lời nhắn (`/settings/event-buttons`)** có nút **"Nghe thử"** phát mẫu giọng nói tiếng Việt tự nhiên cho 4 chủ đề.
