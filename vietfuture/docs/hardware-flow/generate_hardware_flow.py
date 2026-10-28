"""Render the source-audited hardware flow as PNG and editable SVG."""

from pathlib import Path
from html import escape
import hashlib
import json
import math

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
W, H = 4400, 3400
INK = "#152C44"
MUTED = "#4E647A"
BLUE = "#1565A8"
TEAL = "#087E83"
ORANGE = "#A45B0C"
RED = "#AA3542"
BORDER = "#D4DFE9"
im = Image.new("RGB", (W, H), "#F3F6FA")
d = ImageDraw.Draw(im)
svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
    '<rect width="100%" height="100%" fill="#F3F6FA"/>',
]
fonts = {}
checks = []


def font(size, bold=False):
    key = (size, bold)
    if key not in fonts:
        fonts[key] = ImageFont.truetype(
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            size,
        )
    return fonts[key]


def rect(x, y, w, h, fill="white", stroke=BORDER, r=22):
    d.rounded_rectangle((x, y, x + w, y + h), radius=r, fill=fill, outline=stroke, width=2)
    svg.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    )


def text(x, y, s, size=32, color=INK, bold=False):
    f = font(size, bold)
    d.text((x, y), s, font=f, fill=color, anchor="lt")
    svg.append(
        f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" '
        f'font-size="{size}" font-weight="{"700" if bold else "400"}" fill="{color}">{escape(s)}</text>'
    )
    box = d.textbbox((x, y), s, font=f, anchor="lt")
    assert 0 <= box[0] and box[2] <= W and 0 <= box[1] and box[3] <= H, (s, box)


def wrapped(x, y, s, width, size=31, color=MUTED, bold=False, leading=1.3):
    cursor = y
    for paragraph in s.split("\n"):
        words = paragraph.split()
        line = ""
        for word in words:
            trial = (line + " " + word).strip()
            if d.textlength(trial, font=font(size, bold)) > width and line:
                text(x, cursor, line, size, color, bold)
                cursor += int(size * leading)
                line = word
            else:
                line = trial
        if line:
            assert d.textlength(line, font=font(size, bold)) <= width, line
            text(x, cursor, line, size, color, bold)
        cursor += int(size * leading)
    return cursor


def card(x, y, w, h, title, body, accent=BLUE, fill="white", title_size=35, size=31):
    rect(x, y, w, h, fill)
    rect(x + 1, y + 20, 7, h - 40, accent, accent, 3)
    text(x + 27, y + 25, title, title_size, accent, True)
    end = wrapped(x + 27, y + 80, body, w - 54, size)
    # wrapped() returns the next baseline slot; the actual last glyph ends earlier.
    glyph_bottom = end - int(size * 1.3) + size
    assert glyph_bottom <= y + h - 10, (title, glyph_bottom, y + h)
    checks.append({"card": title, "bottom": glyph_bottom, "limit": y + h - 10})


def arrow(points, color=BLUE, width=5, dashed=False):
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        if dashed:
            length = math.hypot(x2 - x1, y2 - y1)
            for i in range(0, int(length), 22):
                a, b = i / length, min(i + 12, length) / length
                d.line((x1 + (x2 - x1) * a, y1 + (y2 - y1) * a,
                        x1 + (x2 - x1) * b, y1 + (y2 - y1) * b), fill=color, width=width)
        else:
            d.line((x1, y1, x2, y2), fill=color, width=width)
    x, y = points[-1]
    px, py = points[-2]
    a = math.atan2(y - py, x - px)
    tri = [(x, y)] + [
        (x - 17 * math.cos(a + q), y - 17 * math.sin(a + q)) for q in (-0.45, 0.45)
    ]
    d.polygon(tri, fill=color)
    pts = " ".join(f"{x},{y}" for x, y in points)
    dash = ' stroke-dasharray="12 10"' if dashed else ""
    svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}"{dash}/>')
    svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in tri)}" fill="{color}"/>')


def section(y, letter, title, subtitle):
    rect(80, y, 4240, 86, "#E8EFF7", "#E8EFF7", 15)
    rect(100, y + 15, 54, 54, BLUE, BLUE, 12)
    text(115, y + 23, letter, 35, "white", True)
    text(178, y + 19, title, 41, INK, True)
    if subtitle:
        text(178, y + 61, subtitle, 21, MUTED)


# Header
text(80, 65, "LUMO HUB", 40, TEAL, True)
text(80, 130, "SƠ ĐỒ LUỒNG HOẠT ĐỘNG PHẦN CỨNG", 78, INK, True)
text(83, 235, "Chuyển động → cảm biến → xử lý tại vòng tay → BLE → Hub → thông báo và điều khiển", 36, MUTED)
rect(3350, 54, 970, 66, "#E2F2ED", "#E2F2ED", 33)
text(3380, 71, "ĐỐI CHIẾU SOURCE • 29/10/2026", 31, TEAL, True)
text(83, 295, "Phạm vi: vietfuture/ • Hub: ESP32-S3, MODE=full • Band: ESP32-C3 • Firmware Hub: v0.5.10", 29, MUTED)

# A — Physical/data architecture.
section(365, "A", "ĐƯỜNG ĐI CỦA CHUYỂN ĐỘNG VÀ DỮ LIỆU", "Mũi tên biểu diễn tín hiệu / dữ liệu / lệnh; không biểu diễn chuyển động cơ khí của robot.")
card(80, 490, 500, 275, "NGƯỜI ĐEO", "Đi lại, xoay tay,\nva chạm hoặc ngã.\nVòng tay đi theo\nchuyển động cơ thể.", TEAL)
card(665, 490, 725, 275, "CẢM BIẾN MPU6050", "Gia tốc 3 trục + gyro 3 trục.\nI²C: SDA=GPIO3, SCL=GPIO4\nĐịa chỉ 0x68 • 400 kHz\nLấy mẫu mỗi 100 ms (10 Hz).", TEAL)
card(1475, 490, 805, 275, "LUMO BAND • ESP32-C3", "Tính |a|, |gyro| và peak 1 giây.\nMáy trạng thái phát hiện ngã.\nĐóng gói payload 12 byte, v0x02.\nBLE peripheral: LUMO-TEST-C3.", BLUE)
card(2365, 490, 825, 275, "LUMO HUB • ESP32-S3", "BLE central: scan → connect\n→ tìm service/characteristic\n→ bật Notify → cập nhật state.\nĐánh giá cảnh báo tại Hub.", BLUE)
card(3275, 490, 1045, 275, "BACKEND → WEB / TRÌNH DUYỆT", "Hub gửi cảnh báo qua HTTPS / Wi-Fi.\nFastAPI lưu thông báo vào PostgreSQL;\nphát realtime và Web Push nếu đủ điều kiện.\nWeb cũng gửi lệnh điều khiển loa về Hub.", BLUE, title_size=33)
for x1, x2 in [(580, 665), (1390, 1475), (2280, 2365), (3190, 3275)]:
    arrow([(x1, 625), (x2, 625)])
text(90, 800, "DỮ LIỆU BLE THỰC TẾ", 30, TEAL, True)
wrapped(90, 847,
        "Gửi thường: mỗi 1 giây. Khi FALL_CONFIRMED: gửi ngay khi chuyển trạng thái, sau đó mỗi 5 giây; chỉ Notify khi Hub đã kết nối và đăng ký.",
        2020, 30)
wrapped(90, 950,
        "12 byte: version(1) | state(1) | |a|×100(2) | peak×100(2) | HR(1) | steps(2) | battery(1) | reserved(2). Các trường 2 byte dùng little-endian.",
        2020, 29)
text(2245, 800, "CÁC NGOẠI VI TẠI HUB", 30, TEAL, True)
wrapped(2245, 847,
        "Nút nhấn: GPIO42, active LOW. Loa: I²S BCLK=5 / LRCK=4 / DATA=6, qua mạch âm thanh. Mic: I²S BCLK=15 / WS=16 / DATA=17, 16 kHz.",
        2050, 30)
wrapped(2245, 950,
        "BLE mất kết nối: Band quảng bá lại, Hub quét lại. Dữ liệu cảm biến chuyển động được xử lý tại Band/Hub; chưa có luồng tự đẩy telemetry này lên web.",
        2050, 29)

# B — State machine / actual runtime action.
section(1085, "B", "PHÁT HIỆN CHUYỂN ĐỘNG / NGÃ VÀ HÀNH ĐỘNG THỰC TẾ", "Hai lớp xử lý độc lập: máy trạng thái trên Band và bộ đánh giá cảnh báo trên Hub.")
rect(80, 1195, 2760, 855)
text(115, 1225, "MÁY TRẠNG THÁI TRÊN BAND  [1]", 35, TEAL, True)
card(120, 1320, 460, 190, "IDLE", "Theo dõi cảm biến.\nBLE: IDLE hoặc MOVE.", TEAL, size=29, title_size=33)
card(860, 1320, 655, 190, "IMPACT_WAIT", "Theo dõi hồi phục / đứng yên.\nCửa sổ tối đa: 10 giây.", ORANGE, fill="#FFF9F0", size=29, title_size=33)
card(1905, 1320, 875, 190, "FALL_CONFIRMED", "Đủ điều kiện đứng yên 5 giây liên tục.\nGửi trạng thái ngã qua BLE.", RED, fill="#FFF3F3", size=29, title_size=33)
arrow([(580, 1415), (860, 1415)], TEAL)
text(612, 1360, "|a| ≥ 4 g", 31, TEAL, True)
arrow([(1515, 1415), (1905, 1415)], ORANGE)
text(1540, 1350, "Đứng yên liên tục", 29, ORANGE, True)
text(1615, 1386, "≥ 5 giây", 29, ORANGE, True)
arrow([(1030, 1510), (1030, 1560), (510, 1560), (510, 1610)], TEAL)
arrow([(1240, 1510), (1240, 1610)], ORANGE)
arrow([(2330, 1510), (2330, 1610)], RED)
card(120, 1610, 790, 220, "CÓ CHUYỂN ĐỘNG TRỞ LẠI", "3 mẫu moving liên tiếp (≈300 ms)\n→ RECOVERED → IDLE ở mẫu kế tiếp.", TEAL, size=29, title_size=31)
card(955, 1610, 770, 220, "HẾT CỬA SỔ THEO DÕI", "Sau 10 giây vẫn ở IMPACT_WAIT\n→ về IDLE, xóa bộ đếm theo dõi.", ORANGE, size=29, title_size=31)
card(1770, 1610, 1010, 220, "XÓA TRẠNG THÁI NGÃ", "5 mẫu moving liên tiếp (≈500 ms)\n→ FALL_CONFIRMED trở về IDLE.", RED, size=29, title_size=31)
text(120, 1875, "moving: |a| > 1,5 g HOẶC |gyro| > 50°/s.", 30, INK, True)
text(120, 1928, "still: 0,85 g ≤ |a| ≤ 1,15 g VÀ |gyro| < 10°/s.", 30, INK, True)
text(120, 1980, "Đọc cảm biến lỗi → SENSOR_OFFLINE. |a| = √(ax² + ay² + az²).", 29, MUTED)

rect(2890, 1195, 1430, 855)
text(2925, 1225, "BỘ ĐÁNH GIÁ TRÊN HUB  [2]", 35, BLUE, True)
card(2930, 1305, 1350, 230, "NHÁNH CÓ PHÁT LOA + GỬI PUSH", "Khi evaluator trả HIGH_ACTIVITY (peak ≥ 5 g):\nphát /spiffs/risk.wav 2 lần → chạy task gửi\nPOST /api/v1/push/send 3 lần tới user_id=1.\nPhụ thuộc ưu tiên cảnh báo và trạng thái evaluator.", ORANGE, fill="#FFF9F0", title_size=31, size=29)
card(2930, 1565, 1350, 230, "NHÁNH NGÃ HIỆN CHỈ XỬ LÝ / GHI LOG", "Hub nhận IMPACT_WAIT / FALL_CONFIRMED.\nCó thêm classifier: peak ≥ 5 g, |a| < 1,05 g\nliên tục 3 giây trong cửa sổ 6 giây.\nHandler âm thanh của 2 cảnh báo ngã đang return.", RED, fill="#FFF3F3", title_size=30, size=29)
wrapped(2930, 1835,
        "Vì vậy, trạng thái ngã không tự dẫn tới loa hoặc push trong runtime này. Không thể mô tả luồng cảnh báo ngã hoàn chỉnh chỉ từ tên state.",
        1340, 31, RED, True)
wrapped(2930, 1970,
        "5 g là giá trị macro hiện tại (500/100), dù nhiều chú thích cũ ghi 8 g.",
        1340, 28)

# C — Sequential button and reverse web control.
section(2100, "C", "HAI LUỒNG TƯƠNG TÁC ĐANG BẬT", "Nút nhấn gửi thông báo / check-in; web điều khiển phát các file âm thanh có sẵn trên Hub.")
card(80, 2235, 840, 225, "01 • NHẤN RỒI THẢ NÚT", "GPIO42 → debounce 5 ms.\nTask đọc nút mỗi 10 ms.\nĐưa thời điểm bấm vào queue.", TEAL, title_size=32, size=30)
card(1020, 2235, 1020, 225, "02 • HTTP WORKER", "Queue RAM: tối đa 32 sự kiện.\nKiểm tra Wi-Fi + đồng hồ NTP.\nMã Hub hiện tại: 0001.", TEAL, title_size=32, size=30)
card(2140, 2235, 1060, 225, "03 • HTTPS → FASTAPI", "POST /api/v1/push/send ×3.\nSau đó POST /api/v1/event-buttons\nvới device_id + thời điểm UTC.", TEAL, title_size=32, size=30)
card(3300, 2235, 1020, 225, "04 • LƯU / HIỂN THỊ", "Push: thông báo tới user_id=1.\nCheck-in: theo chủ sở hữu Hub;\nlưu event + last_checkin_at.", TEAL, title_size=32, size=30)
for x1, x2 in [(920, 1020), (2040, 2140), (3200, 3300)]:
    arrow([(x1, 2350), (x2, 2350)], TEAL)

card(80, 2530, 840, 225, "01 • WEB CHỌN ÂM THANH", "beep / greeting / checkin\nhoặc lệnh stop_audio.\nNgười dùng đã đăng nhập.", BLUE, title_size=31, size=30)
card(1020, 2530, 1020, 225, "02 • REST API + QUYỀN", "POST /api/v1/devices/{id}/commands\nKiểm tra JWT, chủ sở hữu / admin.\nBackend chuyển lệnh tới Hub.", BLUE, title_size=31, size=29)
card(2140, 2530, 1060, 225, "03 • WEBSOCKET TỚI HUB", "/ws/lumo?device_id=0001\nĐăng ký: hello → ready.\nNhận command có request_id.", BLUE, title_size=31, size=30)
card(3300, 2530, 1020, 225, "04 • SPIFFS → I²S → LOA", "Hub phát WAV hoặc dừng loa.\nTrả command_result về backend;\nweb cập nhật kết quả theo ACK.", BLUE, title_size=31, size=30)
for x1, x2 in [(920, 1020), (2040, 2140), (3200, 3300)]:
    arrow([(x1, 2640), (x2, 2640)], BLUE)
arrow([(3800, 2755), (3800, 2805), (490, 2805), (490, 2755)], BLUE)
rect(1560, 2781, 1510, 48, "#F3F6FA", "#F3F6FA", 4)
text(1580, 2788, "Đường phản hồi: command_result → API → giao diện web", 27, BLUE)

# D — Essential implementation caveats.
rect(80, 2875, 4240, 355, "#E9EEF4", "#E9EEF4")
text(115, 2900, "LƯU Ý ĐỂ SỬ DỤNG ĐÚNG TRONG BÁO CÁO", 35, INK, True)
wrapped(115, 2970,
        "DỮ LIỆU GIẢ LẬP\nNhịp tim 60–100 bpm, số bước 1.000–9.999 và pin 50–100% do esp_random() tạo. Gia tốc / gyro đọc từ MPU6050. Không dùng các số giả lập để kết luận sức khỏe.",
        1290, 29)
wrapped(1550, 2970,
        "CẤU HÌNH ĐANG TẮT / CHƯA NỐI\nvoice_assistant=false; hàm ghi âm/upload giọng nói đã vô hiệu hóa. Mic chỉ đọc/xử lý mức âm cục bộ. OLED đã gỡ. API telemetry có trong backend nhưng firmware hiện chưa gọi.",
        1280, 29)
wrapped(2980, 2970,
        "ĐIỀU KIỆN VẬN HÀNH\nSự kiện nút bị bỏ qua nếu mất Wi-Fi hoặc chưa có giờ hợp lệ; queue không lưu bền vững. Web Push cần subscription/VAPID. Đây là sơ đồ code prototype, chưa phải kết quả thử phần cứng.",
        1290, 29)
text(85, 3270, "[1] Band: src/main.c, src/mpu6050.c  •  [2] Hub: main/ble/lumo_band_state.{c,h}, main/lumo_runtime.c", 27, MUTED)
text(85, 3315, "Nguồn và vị trí dòng chi tiết: SOURCES.md cùng thư mục  •  Source snapshot: working tree ngày 29/10/2026 (Asia/Saigon)", 27, MUTED)

OUT.mkdir(parents=True, exist_ok=True)
im.save(OUT / "LUMO_HARDWARE_FLOW.png", dpi=(300, 300))
svg.append("</svg>")
(OUT / "LUMO_HARDWARE_FLOW.svg").write_text("\n".join(svg), encoding="utf-8")
preview = im.copy()
preview.thumbnail((1760, 1360))
preview.save(OUT / "LUMO_HARDWARE_FLOW_preview.png")

source_paths = [
    "lumo-vietfuture/Lumo-Band/main/CMakeLists.txt",
    "lumo-vietfuture/Lumo-Band/src/main.c",
    "lumo-vietfuture/Lumo-Band/src/mpu6050.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/CMakeLists.txt",
    "lumo-vietfuture/Lumo-LuminosTech/main/Lumo-LuminosTech.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/lumo_runtime.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_central.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_state.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/ble/lumo_band_state.h",
    "lumo-vietfuture/Lumo-LuminosTech/main/device_control/device_control.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/http_api/http_api.c",
    "lumo-vietfuture/Lumo-LuminosTech/main/lumo_version.h",
    "lumo-vietfuture/Lumo-LuminosTech/main/button/button.c",
    "lumo-vietfuture/Lumo-LuminosTech/sdkconfig",
    "lumo-vietfuture/Lumo-Band/sdkconfig",
    "backend-vietfuture/app/routes/push.py",
    "backend-vietfuture/app/routes/event_buttons.py",
    "backend-vietfuture/app/routes/devices.py",
    "backend-vietfuture/app/websocket/routes.py",
    "backend-vietfuture/app/crud/event_button.py",
    "backend-vietfuture/app/websocket/manager.py",
    "frontend-web-vietfuture/src/components/devices/DeviceAudioControl.tsx",
]
manifest = {
    "source_date": "2026-10-29",
    "timezone": "Asia/Saigon",
    "image_pixels": [W, H],
    "files": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in source_paths},
    "layout_checks": checks,
}
(OUT / "source_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Generated PNG + SVG: {W}x{H}; {len(checks)} card bounds checked.")
