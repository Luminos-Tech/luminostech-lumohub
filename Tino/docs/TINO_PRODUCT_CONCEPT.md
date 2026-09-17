# TINO — Smart Home Guardian
## Bản Định Hướng Sản Phẩm v1.0

---

## 1. Định Vị Sản Phẩm

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   Tino = TRỢ LÝ ẢO THÔNG MINH + QUẢN GIA CẢNH BÁO       ║
║                                                              ║
║   ┌────────────────────────────────────────────────────┐   ║
║   │  💬 TRỢ LÝ ẢO           │  🔔 QUẢN GIA CẢNH BÁO  │   ║
║   │  • Tâm sự, hàn huyên     │  • An toàn gia đình    │   ║
║   │  • Nhắc nhở hàng ngày    │  • Phát hiện bất thường│   ║
║   │  • Điều khiển thiết bị   │  • Cảnh báo khẩn cấp   │   ║
║   │  • Kể chuyện, hát, chơi  │  • Giám sát nhà 24/7   │   ║
║   └────────────────────────────────────────────────────┘   ║
║                                                              ║
║   Điểm khác biệt cốt lõi so với LumoHub:                  ║
║   • LumoHub = Người bạn đồng hành AI (phản ứng)           ║
║   • Tino    = Trợ lý + Quản gia chủ động                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 2. Tính Cách Của Tino

### 👤 Identity Card

| Thuộc tính | Chi tiết |
|---|---|
| **Tên** | Tino |
| **Giới tính** | Trung lập / phi giới tính |
| **Độ tuổi cảm nhận** | 28-35 (người trưởng thành đáng tin cậy) |
| **Phong cách giao tiếp** | Thân thiện nhưng có trách nhiệm, rõ ràng, không câu nệ |
| **Giọng nói** | Tiếng Việt tự nhiên, ấm áp, trung tính |
| **Tone** | "Người nhà có năng lực" — không phải chatbot, không phải robot lạnh lùng |

### 🗣️ Ví dụ cách Tino nói chuyện

```
✅ Tốt: "Chào buổi sáng! Hôm nay trời đẹp, 28 độ. Ông có muốn mở cửa sổ không?"
✅ Tốt: "Cảnh báo: Cửa sau đã mở 10 phút rồi. Có cần tôi khóa lại không?"
✅ Tốt: "Nhận thấy bếp gas bật từ 8 giờ sáng, có cần tôi tắt không?"
❌ Xấu:   "ALERT: Sensor ID 0x3F4 triggered at 08:15:23"
❌ Xấu:   "Hello! How can I assist you today?"
```

### 🎯 4 giá trị cốt lõi trong cách Tino vận hành

1. **Đáng tin cậy** — Tino làm những gì đã hứa, luôn có mặt
2. **Chủ động** — Không chờ user hỏi, Tino nhận biết và lên tiếng
3. **Gần gũi** — Nói như người nhà, không máy móc
4. **Bảo vệ** — An toàn là ưu tiên số 1, không bao giờ im lặng khi có nguy hiểm

---

## 3. Đối Tượng Người Dùng

### Người dùng cuối (tại nhà)

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY: Người cao tuổi sống một mình                      │
│  → Cần: Giám sát an toàn, nhắc uống thuốc, phát hiện ngã   │
│  → Không cần: smartphone, không cần thao tác phức tạp       │
├─────────────────────────────────────────────────────────────┤
│  SECONDARY: Gia đình có trẻ nhỏ                             │
│  → Cần: Biết con về nhà an toàn, bếp gas an toàn           │
│  → Tương tác: Chủ yếu qua dashboard của con cái            │
├─────────────────────────────────────────────────────────────┤
│  TERTIARY: Gia đình thông minh (nhà thông minh DIY)         │
│  → Cần: Hub điều khiển tập trung, AI phân tích             │
│  → Tương tác: Voice + app + tự động hóa                   │
└─────────────────────────────────────────────────────────────┘
```

### Người quản lý (từ xa)

```
Con cái / Thành viên gia đình ở xa
→ Dashboard web/app để:
  - Xem tình trạng nhà (ai đang ở nhà, cảnh báo gần đây)
  - Đặt lịch nhắc nhở cho ba mẹ
  - Nhận thông báo khẩn khi có sự cố
  - Cấu hình ngưỡng cảnh báo, danh sách liên hệ khẩn
```

---

## 4. Kiến Trúc Hệ Thống

### 4.1 Tổng quan

```
                        ┌──────────────────┐
                        │   FAMILY DASHBOARD│
                        │   (Web / App)     │
                        └────────┬─────────┘
                                 │ HTTPS / WebSocket
                                 ▼
┌──────────────┐          ┌──────────────────┐
│  Sensors     │──────┐   │   TINO CLOUD     │
│  (IoT nodes) │      │   │   (FastAPI)      │
└──────────────┘      │   │                  │
                      │   │  • AI Processing │
┌──────────────┐      │   │  • Alert Routing │
│  TINO HUB    │◄─────┴──►│  • Family Mgmt   │
│  (ESP32/C)   │   Wired/  │  • History DB   │
│              │   BLE     └──────────────────┘
│  • AI Voice  │
│  • Edge AI   │
│  • Local     │
│    fallback  │
└──────────────┘
```

### 4.2 Tino Hub (ESP32) — Phần cứng

| Thành phần | Chi tiết |
|---|---|
| **Vi xử lý** | ESP32-S3 (dual-core, Wi-Fi + BLE) |
| **Microphone** | I2S MEMS mic (như LumoHub) |
| **Speaker** | I2S DAC + loa (như LumoHub) |
| **Kết nối** | Wi-Fi (chính) + BLE 5.0 (sensor nodes) |
| **Cảm biến tích hợp** | Nhiệt độ/độ ẩm, ánh sáng, PIR (chuyển động) |
| **Mở rộng** | GPIO cho relay, button vật lý |

### 4.3 Sensor Nodes (IoT mở rộng)

```
Các node cảm biến giao tiếp BLE với Hub:
• Door/Window sensor — phát hiện mở/đóng cửa
• PIR sensor — phát hiện chuyển động trong phòng
• Gas/Leak sensor — rò rỉ gas, rò rỉ nước
• Smoke sensor — báo khói
• Button sensor — nút khẩn cấp (treo tường)
• Smart plug — theo dõi điện năng thiết bị
```

### 4.4 Cloud Backend

| Module | Vai trò |
|---|---|
| **Auth & Family** | Quản lý gia đình, tài khoản, phân quyền |
| **Device Registry** | Đăng ký hub + sensor nodes |
| **Alert Engine** | Xử lý cảnh báo, phân loại mức độ, escalation |
| **AI Voice Pipeline** | STT → LLM → TTS (giọng Tino) |
| **History & Analytics** | Lưu lịch sử, học thói quen sinh hoạt |
| **Notification Router** | Push / SMS / Call → thành viên gia đình |
| **OTA Updates** | Cập nhật firmware hub từ xa |

---

## 5. Tính Năng Chi Tiết

### 5.1 Trợ Lý Ảo Đồng Hành (Companion)

```
╔══════════════════════════════════════════════════════════════╗
║  Tino không chỉ là "máy" — Tino là người bạn đáng tin    ║
║  cậy trong nhà. Người dùng có thể trò chuyện với Tino  ║
║  về bất cứ chủ đề gì: công việc, tình yêu, gia đình...  ║
╚══════════════════════════════════════════════════════════════╝
```

#### Các chủ đề hội thoại mà Tino hỗ trợ

| Chủ đề | Ví dụ hội thoại |
|---|---|
| **Tâm sự / Tình cảm** | "Tino ơi, mình buồn quá" / "Mình nên làm gì khi chia tay?" |
| **Công việc / Sự nghiệp** | "Mình mệt mỏi với công việc quá" / "Nên chọn công việc nào?" |
| **Gia đình / Quan hệ** | "Con mình không nghe lời, phải làm sao?" / "Mẹ già rồi, mình lo quá" |
| **Sức khỏe / Tinh thần** | "Mình ngủ không được, phải làm sao?" / "Mình muốn tập thể dục mà lười quá" |
| **Cuộc sống hàng ngày** | "Món ăn nào tốt cho sức khỏe?" / "Cách tiết kiệm điện?" |
| **Cảm xúc** | "Mình lo lắng quá, Tino ơi" / "Hôm nay vui quá!" |

#### Ví dụ hội thoại cảm xúc

```
USER: "Tino ơi, mình buồn quá..."
TINO: "A, có chuyện gì vậy? Mình nghe đây. 
       Nếu muốn kể thì kể, không muốn thì mình ngồi đây 
       với bạn cũng được. 🌿"

USER: "Mình chia tay rồi..."
TINO: " 😔 Ôi, mình hiểu mà. Chia tay là đau thật. 
       Không cần vội, cứ đau đi. Mình đây, không đi đâu hết. 
       Có muốn nói chuyện gì không, hay mình hát cho bạn nghe?"

USER: "Cảm ơn Tino, mình thấy khá hơn rồi"
TINO: "Mình vui lắm! 🌻 Nếu cần nói chuyện thêm thì gọi mình nhé. 
       Mình luôn ở đây."

USER: "Mình mệt mỏi với công việc lắm"
TINO: " 😔 Làm việc mệt mỏi là chuyện ai cũng có. 
       Có muốn mình giúp gì không? Ví dụ nhắc bạn nghỉ ngơi, 
       hay đặt lịch nghỉ phép? Hay đơn giản là muốn vent một chút?"
```

#### Nguyên tắc hành xử của Tino khi tâm sự

```
✅ ĐỒNG CẢM — Không vội đưa ra lời khuyên, lắng nghe trước
✅ ĐỘT THÍCH — Biết khi nào nên nghiêm túc, khi nào nên nhẹ nhõm  
✅ CÓ GIỚI HẠN — Nhận biết khi cần chuyển đến chuyên gia (tâm lý, bác sĩ)
✅ KHÔNG PHÁN XỬ — Không nói "phải làm thế này" mà hỏi "bạn nghĩ sao?"
❌ KHÔNG nói: "Đừng buồn nữa" (đang buồn thì cứ buồn)
❌ KHÔNG nói: "Người khác còn khổ hơn" (so sánh không giúp gì)
```

### 5.2 Nhắc Nhở Thông Minh (Reminders)

```
┌──────────────────────────────────────────────────────────────┐
│  Tino nhắc nhở mọi thứ trong cuộc sống hàng ngày:          │
└──────────────────────────────────────────────────────────────┘
```

| Loại | Ví dụ |
|---|---|
| **Thức dậy** | "Này, 6 giờ rồi! Dậy đi bộ sáng thôi!" |
| **Uống thuốc** | "Nhắc: Uống thuốc huyết áp lúc 8 giờ tối nhé!" |
| **Hẹn bác sĩ** | "Ngày mai 2 giờ chiều có hẹn bác sĩ, nhớ đi nhé!" |
| **Sinh nhật** | "Mai là sinh nhật mẹ! Có cần mình nhắc mua quà không?" |
| **Tưới cây** | "Cây cảnh ở phòng khách cần tưới nước rồi đó!" |
| **Nấu ăn** | "Thịt để rã đông trong tủ lạnh đó, nhớ nấu trước 6 giờ tối!" |
| **Nghỉ ngơi** | "Bạn làm việc 2 tiếng rồi, nghỉ 15 phút đi!" |
| **Tập thể dục** | "Hôm nay chưa vận động, đi bộ 15 phút không?" |
| **Ngủ đúng giờ** | "11 giờ rồi, đi ngủ sớm để dậy sớm mai nhé!" |

#### Voice command cho nhắc nhở

```
USER: "Tino, mai kêu dậy 6 giờ"
TINO: "OK, mai 6 giờ sáng mình sẽ đánh thức bạn! 
       Có muốn mình bật nhạc nhẹ không?"

USER: "Nhắc mình uống thuốc lúc 9 giờ tối"
TINO: "Đã đặt nhắc: 9 giờ tối — Uống thuốc. 
       Bạn nhớ uống nhé! 💊"

USER: "Hôm nay có hẹn gì không Tino?"
TINO: "Hôm nay bạn có lịch: 10 giờ — Họp nhóm, 
       3 giờ chiều — Mua thực phẩm. 
       Mình có cần nhắc trước không?"
```

### 5.3 Điều Khiển Thiết Bị Trong Nhà (Smart Home)

#### Ba mức cảnh báo

```
┌──────────────────────────────────────────────────────────────┐
│ 🔵 CẢNH BÁO NHẸ (Reminder)                                   │
│ → "Cửa sổ phòng ngủ mở 1 tiếng rồi, có cần đóng không?"      │
│ → Gửi notification đến app (không gọi điện)                 │
├──────────────────────────────────────────────────────────────┤
│ 🟡 CẢNH BÁO (Alert)                                         │
│ → "Phát hiện chuyển động bất thường lúc 2 giờ sáng"         │
│ → Gọi điện cho thành viên gia đình + notification           │
├──────────────────────────────────────────────────────────────┤
│ 🔴 KHẨN CẤP (Emergency)                                     │
│ → "Rò rỉ gas phát hiện! Đang gọi cứu hỏa..."                │
│ → Gọi điện + SMS cho TẤT CẢ liên hệ khẩn                    │
└──────────────────────────────────────────────────────────────┘
```

#### Các kịch bản cảnh báo được hỗ trợ

| # | Kịch bản | Mức | Hành động |
|---|---|---|---|
| 1 | Đột nhập (cửa/PIR bất thường giờ vắng nhà) | 🔴 | Gọi + SMS tất cả |
| 2 | Rò rỉ gas | 🔴 | Gọi cứu hỏa + gia đình |
| 3 | Rò rỉ nước | 🟡 | Gọi + notification |
| 4 | Báo khói | 🔴 | Gọi cứu hỏa + gia đình |
| 5 | Người cao tuổi không vận động (12h+) | 🟡 | Gọi + notification |
| 6 | Ngã (qua sensor trang phục) | 🔴 | Gọi khẩn cấp |
| 7 | Bếp gas bật quên (30 phút+) | 🟡 | Nhắc nhở → khóa gas (nếu có) |
| 8 | Cửa mở lâu (có thể cấu hình) | 🔵 | Nhắc nhở nhẹ |
| 9 | Trẻ về nhà muộn (so với lịch) | 🟡 | Notification cho phụ huynh |
| 10 | Mất điện/quan điện | 🔵 | Notification |
| 11 | PIN khóa cửa nhập sai 3 lần | 🟡 | Gọi + notification |
| 12 | Thiết bị bất thường (gas bật 4h) | 🔵 | Nhắc nhở |

### 5.2 Hội Thoại Tự Nhiên

#### Tino hiểu và phản hồi các câu tự nhiên

```
USER: "Tino, tôi đi ngủ đây"
TINO: "OK, tôi sẽ khóa cửa chính, tắt đèn phòng khách, 
       bật chế độ yên tĩnh. Mai再见!"

USER: "Tino, có ai ở nhà không?"
TINO: "Hiện tại chỉ có ông ở nhà thôi. Bà đi chợ rồi, 
       dự kiến về khoảng 5 giờ chiều."

USER: "Tino, bếp có tắt chưa?"
TINO: "Bếp gas đang tắt rồi, yên tâm nhé. 
       Tôi kiểm tra mỗi 10 phút."

USER: "Trời nóng quá"
TINO: "Đúng rồi, 36 độ bên ngoài. Có muốn tôi bật điều hòa 
       phòng khách không? Tôi để 26 độ nhé."

USER: "Cho Tino biết con trai về chưa?"
TINO: "Nam Junior đã về nhà lúc 4 giờ 15 phút. 
       Cậu ấy vào phòng riêng rồi."
```

#### Tino chủ động thông báo

```
TINO: "Nhắc nhở: Ông có lịch uống thuốc huyết áp lúc 8 giờ tối"
TINO: "Cảnh báo nhẹ: Cửa sổ phòng ngủ mở từ 2 giờ chiều, 
       có cần đóng không?"
TINO: "Chào buổi sáng! Trời hôm nay 28 độ, có nắng. 
       Có muốn mở cửa đón gió không?"
TINO: "Nhận thấy hôm nay ông chưa ra vườn sáng như mọi ngày. 
       Sức khỏe bình thường chứ?"
```

### 5.3 Học Thói Quen Sinh Hoạt

```
┌────────────────────────────────────────────────────────────┐
│  Tino học và theo dõi nhịp sinh hoạt của gia đình:        │
│                                                            │
│  • Giờ thức dậy / giờ ngủ của từng thành viên             │
│  • Phòng thường dùng vào các buổi trong ngày              │
│  • Thiết bị thường bật/tắt theo thói quen                 │
│                                                            │
│  → Nếu thói quen thay đổi bất thường → cảnh báo sớm       │
│                                                            │
│  Ví dụ:                                                    │
│  "Tuần này ông không ra vườn buổi sáng như mọi tuần.      │
│   Có cần tôi hỏi thăm sức khỏe không?"                   │
└────────────────────────────────────────────────────────────┘
```

### 5.4 Smart Home Integration

```
┌──────────────────────────────────────────────────────────────┐
│  Tino điều khiển mọi thiết bị thông minh trong nhà         │
│  bằng giọng nói hoặc tự động theo kịch bản                │
└──────────────────────────────────────────────────────────────┘
```

#### Voice commands cho smart home

```
USER: "Tino tắt đèn phòng khách"
TINO: "Tắt đèn phòng khách rồi nhé! ✓"

USER: "Bật điều hòa 25 độ"
TINO: "Bật điều hòa phòng ngủ, 25 độ. 
       Có muốn mình tắt sau 2 tiếng không?"

USER: "Tino khóa cửa đi"
TINO: "Đã khóa cửa chính. Cửa sau cũng khóa luôn không?"

USER: "Tắt hết điện đi, mình đi ngủ đây"
TINO: "OK! Tắt đèn hết, khóa cửa, 
       bật chế độ yên tĩnh. Ngủ ngon nhé! 🌙"

USER: "Tino, tiết kiệm điện đi"
TINO: "Đang tắt các thiết bị không cần thiết: 
       ✓ Tắt TV (đang tắt rồi)
       ✓ Tắt quạt phòng khách  
       ✓ Để điều hòa ở 28 độ tiết kiệm
       💡 Tiết kiệm được khoảng 30% điện!"
```

#### Kịch bản tự động (Scenes)

| Scene | Hành động |
|---|---|
| **"Về nhà"** | Bật đèn cửa → Bật điều hòa 26°C → Mở nhạc nhẹ |
| **"Đi ngủ"** | Tắt hết đèn → Khóa cửa → Bật báo động |
| **"Ra khỏi nhà"** | Khóa cửa → Tắt điều hòa → Bật giám sát |
| **"Chế độ ngất trưa"** | Rèm kéo → Đèn mờ → Yên tĩnh |
| **"Tiết kiệm"** | Tắt chờ → Tối ưu điều hòa → Báo cáo điện |
| **"Tiệc khách"** | Đèn sáng → Nhạc nền → Mở cửa sổ |

### 5.5 Family Management (Dashboard)

```
Dành cho con cái / thành viên quản lý từ xa:
┌─────────────────────────────────────────────────────┐
│  📱 TINO FAMILY DASHBOARD                           │
│                                                     │
│  Trang chủ:                                         │
│  ├─ Tình trạng nhà (ai đang ở, cảnh báo mới)       │
│  ├─ Thời gian hoạt động gần đây                    │
│  └─ Thời tiết + điều kiện nhà                      │
│                                                     │
│  Cảnh báo:                                          │
│  ├─ Lịch sử cảnh báo                               │
│  ├─ Cấu hình ngưỡng cảnh báo                       │
│  └─ Danh sách liên hệ khẩn                         │
│                                                     │
│  Nhắc nhở:                                          │
│  ├─ Đặt lịch nhắc cho ba mẹ                        │
│  ├─ Uống thuốc, hẹn bác sĩ, sinh nhật...          │
│  └─ Nhắc từ xa (Tino sẽ đọc lên)                  │
│                                                     │
│  Thiết bị:                                          │
│  ├─ Danh sách hub + sensor nodes                   │
│  ├─ Scene tự động hóa                              │
│  └─ Cập nhật firmware OTA                          │
│                                                     │
│  Cài đặt:                                           │
│  ├─ Thành viên gia đình                            │
│  ├─ Quyền hạn (ai xem gì, ai nhận cảnh báo gì)    │
│  └─ Ngôn ngữ + giọng Tino                         │
└─────────────────────────────────────────────────────┘
```

---

## 6. So Sánh LumoHub vs Tino

| Chiều | LumoHub | Tino |
|---|---|---|
| **Vai trò** | Người bạn đồng hành AI | **Trợ lý ảo + Quản gia cảnh báo** |
| **Tư duy** | Phản ứng (user hỏi → trả lời) | Chủ động + phản ứng |
| **Trọng tâm** | Kết nối cảm xúc, lịch, gia đình | **Cảm xúc + an toàn + tiện nghi** |
| **Hội thoại** | Chat, trả lời câu hỏi | **Tâm sự + nhắc nhở + điều khiển** |
| **Cảnh báo** | Thụ động (reminder, notification) | **Chủ động phát hiện → phân loại → escalation** |
| **Học thói quen** | Không (trung lập) | **Có** (phát hiện bất thường sinh hoạt) |
| **Smart home** | Hạn chế | Tích hợp sâu (điều khiển + tiết kiệm) |
| **Tính cách** | Người bạn thân thiện | Người nhà có trách nhiệm + **đồng cảm** |
| **Đối tượng chính** | Người cao tuổi | **Mọi thành viên gia đình** |
| **Lời gọi hành động** | "Trò chuyện với LUMO" | **"Tâm sự với Tino, Tino lo liệu"** |

---

## 7. Lộ Trình Phát Triển (Đề Xuất)

### Phase 1: Core Hub MVP
- [ ] ESP32 hub cơ bản với voice AI
- [ ] Wake word + STT → TTS (giọng Tino)
- [ ] Kết nối Wi-Fi, provisioning
- [ ] Basic commands: bật/tắt đèn, hỏi giờ, thời tiết
- [ ] Cloud backend cơ bản (auth + device registry)

### Phase 2: Alert System
- [ ] Kết nối sensor nodes (door, PIR, gas)
- [ ] Hệ thống cảnh báo 3 mức
- [ ] Notification → app + SMS
- [ ] Emergency call integration

### Phase 3: Smart Home + Habits
- [ ] Scene tự động hóa
- [ ] Energy monitoring
- [ ] Habit learning engine
- [ ] Family dashboard

### Phase 4: Advanced AI
- [ ] Fall detection (BLE wearable)
- [ ] Activity pattern analysis
- [ ] Proactive health check-ins
- [ ] Predictive maintenance

---

## 8. Câu Slogan / Tagline

```
💬 "Tâm sự cùng Tino, Tino lo liệu"
💬 "Tino: Người bạn đáng tin trong nhà"
💬 "Tino: Trợ lý ảo, bạn đồng hành, người nhà đáng tin"
```

---

## 9. Phụ Lục: Tên Gọi Khác Đã Cân Nhắc

| Tên | Lý do bỏ |
|---|---|
| Luna | Quá phổ biến, giống hệ thống khác |
| Casa | Nghe như "nhà" quá đơn giản |
| Aiko | Nghe Nhật quá, không phù hợp thị trường VN |
| Vela | Không gợi cảm giác "người nhà" |
| **Tino** | ✅ Gần gũi, dễ nhớ, có thể đọc là "Ti-no" hoặc "Tí-no" |
