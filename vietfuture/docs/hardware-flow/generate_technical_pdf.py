"""Generate a vector A4 engineering diagram of the active source interfaces."""

from pathlib import Path
import hashlib
import json
import math

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / "LUMO_TECHNICAL_FLOW_A4.pdf"
PAGE_W, PAGE_H = A4
pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("ArialBold", "C:/Windows/Fonts/arialbd.ttf"))
c = canvas.Canvas(str(PDF), pagesize=A4, pageCompression=1)
c.setTitle("LUMO - Sơ đồ kỹ thuật luồng dữ liệu và điều khiển")
c.setAuthor("Luminos Tech")
c.setSubject("ESP32-C3 / ESP32-S3: interfaces, firmware data path and control path")
INK, BLUE, GRAY = "#203244", "#155C8C", "#546576"
text_boxes = []


def rect(x, y, w, h, fill="#FFFFFF", stroke="#AEBFCC", radius=5):
    c.setFillColor(colors.HexColor(fill))
    c.setStrokeColor(colors.HexColor(stroke))
    c.setLineWidth(0.7)
    c.roundRect(x, PAGE_H - y - h, w, h, radius, fill=1, stroke=1)


def txt(x, y, s, size=10.5, bold=False, color=INK, max_width=None):
    name = "ArialBold" if bold else "Arial"
    width = pdfmetrics.stringWidth(s, name, size)
    assert x >= 0 and x + width <= PAGE_W - 22, (s, x, width)
    assert 0 <= y and y + size <= PAGE_H - 12, (s, y)
    if max_width is not None:
        assert width <= max_width, (s, width, max_width)
    c.setFillColor(colors.HexColor(color))
    c.setFont(name, size)
    c.drawString(x, PAGE_H - y - size, s)
    text_boxes.append({"text": s, "x": x, "y": y, "font_pt": size, "width": width})


def arrow(points, color=BLUE, dashed=False):
    c.setStrokeColor(colors.HexColor(color))
    c.setFillColor(colors.HexColor(color))
    c.setLineWidth(1.2)
    c.setDash(3, 2) if dashed else c.setDash()
    path = c.beginPath()
    path.moveTo(points[0][0], PAGE_H - points[0][1])
    for x, y in points[1:]:
        path.lineTo(x, PAGE_H - y)
    c.drawPath(path)
    c.setDash()
    x, y = points[-1]
    px, py = points[-2]
    angle = math.atan2(y - py, x - px)
    head = c.beginPath()
    head.moveTo(x, PAGE_H - y)
    for delta in (-0.4, 0.4):
        head.lineTo(x - 6 * math.cos(angle + delta), PAGE_H - y + 6 * math.sin(angle + delta))
    head.close()
    c.drawPath(head, fill=1, stroke=0)


def module(x, y, w, h, heading, lines, head_size=11, body_size=10.2, fill="#FFFFFF"):
    rect(x, y, w, h, fill)
    txt(x + 10, y + 9, heading, head_size, True, BLUE, w - 20)
    top = y + 30
    for line in lines:
        txt(x + 10, top, line, body_size, max_width=w - 20)
        top += 14
    assert top - 14 + body_size <= y + h - 8, heading


txt(30, 29, "LUMO - LUỒNG DỮ LIỆU & ĐIỀU KHIỂN", 19, True)
txt(30, 58, "Sơ đồ kỹ thuật • ESP32-C3 / ESP32-S3 • MODE=full • Source: 29/10/2026", 10, color=GRAY)
txt(30, 81, "Mũi tên chỉ chiều truyền tín hiệu, dữ liệu hoặc lệnh giữa các khối.", 10, color=GRAY)

# Hardware and firmware boundaries.
rect(30, 113, 238, 350, "#F5F8FB")
rect(327, 113, 238, 350, "#F5F8FB")
txt(44, 125, "BAND | ESP32-C3", 12, True, BLUE)
txt(341, 125, "HUB | ESP32-S3", 12, True, BLUE)

module(44, 153, 210, 72, "MPU6050 | IMU 6 trục", [
    "ax, ay, az; gx, gy, gz",
    "I²C addr=0x68; chu kỳ đọc 100 ms",
])
arrow([(149, 225), (149, 280)])
txt(161, 239, "I²C 400 kHz", 9.5, color=BLUE)
txt(161, 253, "SDA=3 / SCL=4", 9.5, color=BLUE)
module(44, 280, 210, 138, "Firmware / FreeRTOS", [
    "mpu6050_task → |a|, peak1s → FSM",
    "sample_task → GATT Notify",
    "Payload 12 byte; version 0x02",
    "Thường: 1 s; FALL: khi vào + mỗi 5 s",
], body_size=10)
txt(44, 436, "HR / steps / battery: dữ liệu giả lập.", 9.5, color=GRAY)

module(341, 153, 210, 72, "NimBLE central / BLE GATT", [
    "scan → connect → subscribe",
    "Notify RX → band_state_update()",
], body_size=10)
arrow([(254, 324), (305, 324), (305, 190), (341, 190)])
txt(271, 241, "BLE", 9, True, BLUE)
txt(271, 254, "Notify", 9, color=BLUE)
arrow([(446, 225), (446, 268)])
txt(454, 239, "g_band_state", 9.5, color=BLUE)
module(341, 268, 210, 100, "Bộ đánh giá cảnh báo", [
    "band_evaluate_alerts()",
    "band_alert_tick() → band_alert_audio()",
    "HIGH_ACTIVITY: peak ≥ 5 g",
    "FALL_*: handler return (đang tắt)",
], body_size=10)
arrow([(446, 368), (446, 391)])
module(341, 391, 210, 64, "SPIFFS → audio_play() → I²S TX", [
    "BCLK=5 / LRCK=4 / DATA=6",
    "Mạch âm thanh → loa",
], head_size=10.3, body_size=9.8)

# Network interface contracts: hardware runtime to software boundary.
arrow([(446, 463), (446, 496)])
arrow([(426, 496), (426, 463)])
txt(457, 474, "Wi-Fi / IP", 9.5, color=BLUE)
rect(30, 496, 535, 114)
txt(44, 507, "GIAO TIẾP HUB ↔ BACKEND (FastAPI)", 12, True, BLUE)
txt(44, 531, "HTTPS: http_task / push_alert_task → POST /api/v1/push/send", 10.5)
txt(44, 549, "Check-in: http_task → POST /api/v1/event-buttons", 10.5)
txt(44, 567, "WS /ws/lumo: backend → command → Hub; Hub → command_result / device_logs", 10)
txt(44, 585, "Đăng ký: hello → ready; giữ kết nối: ping ↔ pong. Mã Hub: 0001.", 10.5)

# Other hardware task inputs, with source module names.
txt(30, 627, "CÁC ĐƯỜNG TÍN HIỆU / TÁC VỤ KHÁC", 11.5, True, BLUE)
txt(30, 651, "GPIO42 → button_poll_task (10 ms) → Queue[32] → http_task → HTTPS", 10.5)
txt(30, 672, "MIC I²S RX (BCLK=15 / WS=16 / DATA=17) → mic_read_frame() → mức âm", 10.5)
txt(30, 691, "Nhận command: device_control → audio_play() / audio_stop(); ACK qua WebSocket.", 10)

# Compact embedded state machine, without product/actor descriptions.
rect(30, 711, 535, 97, "#F5F8FB")
txt(42, 720, "FSM BAND / XỬ LÝ CHUYỂN ĐỘNG", 11, True, BLUE)
txt(42, 740, "IDLE → [|a| ≥ 4 g] → IMPACT_WAIT → [still 5 s] → FALL_CONFIRMED", 10.5)
txt(42, 757, "IMPACT_WAIT: moving ×3 → RECOVERED → IDLE; timeout 10 s → IDLE.", 10)
txt(42, 774, "FALL_CONFIRMED: moving ×5 → IDLE. Chu kỳ mẫu danh định: 100 ms.", 10)
txt(42, 791, "still: 0,85≤|a|≤1,15 g & |ω|<10°/s; moving: |a|>1,5 g OR |ω|>50°/s.", 9.5)

txt(30, 815, "Nguồn: main.c, mpu6050.c, lumo_runtime.c, lumo_band_{central,state}.c, device_control.c.", 8.2, color=GRAY)

c.showPage()
c.save()
reader = PdfReader(PDF)
assert len(reader.pages) == 1
page = reader.pages[0]
assert abs(float(page.mediabox.width) - PAGE_W) < 0.01
assert abs(float(page.mediabox.height) - PAGE_H) < 0.01
extracted = page.extract_text()
assert "NGƯỜI THÂN" not in extracted and "người thân" not in extracted
assert "band_state_update" in extracted and "GPIO42" in extracted
assert "FALL_CONFIRMED" in extracted

sources = [
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
    "backend-vietfuture/app/routes/push.py",
    "backend-vietfuture/app/routes/event_buttons.py",
    "backend-vietfuture/app/websocket/routes.py",
]
manifest = {
    "date": "2026-10-29",
    "page": "A4 portrait; 1 page; vector PDF",
    "source_sha256": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in sources},
    "text_boxes": text_boxes,
}
(OUT / "LUMO_TECHNICAL_FLOW_A4.audit.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"Created: {PDF}")
print(f"Verified: one A4 page, embedded text, {len(text_boxes)} bounded text lines.")
