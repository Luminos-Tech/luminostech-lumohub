"""A short, legible, one-page A4 hardware process diagram."""

from html import escape
from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
SCALE = 2
W, H = 1240, 1754
INK, BLUE, GRAY = "#172B40", "#17659A", "#506273"
image = Image.new("RGB", (W * SCALE, H * SCALE), "white")
draw = ImageDraw.Draw(image)
svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 1240 1754">',
    '<rect width="1240" height="1754" fill="white"/>',
]
font_cache = {}


def font(size, bold):
    if (size, bold) not in font_cache:
        font_cache[size, bold] = ImageFont.truetype(
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            size * SCALE,
        )
    return font_cache[size, bold]


def rect(x, y, w, h, fill="white", stroke="#CBD8E2"):
    draw.rounded_rectangle(
        tuple(v * SCALE for v in (x, y, x + w, y + h)),
        radius=12 * SCALE, fill=fill, outline=stroke, width=2 * SCALE,
    )
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')


def text(x, y, value, size=24, bold=False, color=INK):
    draw.text((x * SCALE, y * SCALE), value, font=font(size, bold), fill=color, anchor="lt")
    svg.append(
        f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" '
        f'font-size="{size}" font-weight="{"700" if bold else "400"}" fill="{color}">{escape(value)}</text>'
    )


def paragraph(x, y, value, width, size=24, color=INK, bold=False):
    cursor = y
    for p in value.split("\n"):
        line = ""
        for word in p.split():
            trial = (line + " " + word).strip()
            if line and draw.textlength(trial, font=font(size, bold)) > width * SCALE:
                text(x, cursor, line, size, bold, color)
                cursor += size * 1.3
                line = word
            else:
                line = trial
        if line:
            assert draw.textlength(line, font=font(size, bold)) <= width * SCALE
            text(x, cursor, line, size, bold, color)
        cursor += size * 1.3
    return cursor - size * 0.3


def box(x, y, w, h, title, body, fill="#F1F7FC", color=BLUE, size=24, heading=27):
    rect(x, y, w, h, fill)
    bottom = paragraph(x + 22, y + 18, title, w - 44, heading, color, True)
    bottom = paragraph(x + 22, bottom + 15, body, w - 44, size)
    assert bottom <= y + h - 12, (title, bottom, y + h)


def arrow(points, color=BLUE):
    draw.line([(x * SCALE, y * SCALE) for x, y in points], fill=color, width=3 * SCALE)
    x, y = points[-1]
    px, py = points[-2]
    a = math.atan2(y - py, x - px)
    tri = [(x, y)] + [
        (x - 13 * math.cos(a + b), y - 13 * math.sin(a + b)) for b in (-0.45, 0.45)
    ]
    draw.polygon([(int(x * SCALE), int(y * SCALE)) for x, y in tri], fill=color)
    svg.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="{color}" stroke-width="3"/>')
    svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in tri)}" fill="{color}"/>')


text(100, 65, "QUY TRÌNH HOẠT ĐỘNG PHẦN CỨNG", 39, True)
text(100, 119, "LUMO Band → LUMO Hub → người thân", 29, False, BLUE)

box(240, 200, 760, 98, "1. NGƯỜI ĐEO DI CHUYỂN", "Đi lại, xoay tay hoặc có va chạm.")
arrow([(620, 298), (620, 338)])
box(170, 338, 900, 185, "2. VÒNG TAY ĐO VÀ XỬ LÝ",
    "MPU6050 đo chuyển động → ESP32-C3 phân loại trạng thái.\n"
    "Va chạm ≥ 4 g + đứng yên 5 giây → trạng thái ngã.")
arrow([(620, 523), (620, 582)])
text(650, 541, "Truyền dữ liệu qua BLE", 23, False, BLUE)
box(170, 582, 900, 120, "3. HUB NHẬN VÀ KIỂM TRA",
    "ESP32-S3 nhận dữ liệu vòng tay, đánh giá và chọn nhánh xử lý.")

arrow([(620, 702), (620, 733), (305, 733), (305, 770)], GRAY)
arrow([(620, 733), (875, 733), (875, 770)])
box(100, 770, 410, 120, "KHÔNG CÓ CẢNH BÁO", "Tiếp tục nhận dữ liệu.", fill="#F5F7F8", color=GRAY, heading=25)
arrow([(100, 830), (65, 830), (65, 643), (170, 643)], GRAY)
box(610, 770, 530, 188, "4. CẢNH BÁO CHUYỂN ĐỘNG MẠNH",
    "Khi Hub chọn nhánh này:\nphát âm thanh cảnh báo 2 lần.\nGia tốc đỉnh đạt từ 5 g.",
    fill="#FFF6E8", color="#89510D", heading=25)
arrow([(875, 958), (875, 1020)])
box(610, 1020, 530, 145, "5. GỬI LÊN MÁY CHỦ",
    "Hub → Wi-Fi / HTTPS → backend.\nMáy chủ lưu và gửi thông báo.", heading=25)
arrow([(875, 1165), (875, 1220)])
box(610, 1220, 530, 120, "6. NGƯỜI THÂN NHẬN TIN",
    "Thông báo trên web / trình duyệt.", heading=25)

box(100, 980, 410, 360, "LƯU Ý VỀ NHÁNH NGÃ",
    "Vòng tay đã gửi trạng thái ngã về Hub.\n\n"
    "Trong code hiện tại, nhánh ngã chưa tự phát loa hoặc gửi thông báo.",
    fill="#FFF4F2", color="#A03632", heading=25)

draw.line((100 * SCALE, 1390 * SCALE, 1140 * SCALE, 1390 * SCALE), fill="#CBD8E2", width=2 * SCALE)
svg.append('<path d="M100 1390H1140" stroke="#CBD8E2" stroke-width="2"/>')
text(100, 1425, "LUỒNG NÚT NHẤN TRÊN HUB", 27, True)
for x, title, body in [
    (100, "NHẤN RỒI THẢ NÚT", "Nút trên LUMO Hub"),
    (470, "HUB GỬI MÁY CHỦ", "Thông báo + check-in"),
    (840, "WEB / TRÌNH DUYỆT", "Lưu và nhận thông báo"),
]:
    box(x, 1480, 300, 105, title, body, heading=22, size=22)
arrow([(400, 1530), (470, 1530)])
arrow([(770, 1530), (840, 1530)])

text(100, 1623, "Điều khiển loa: Web → máy chủ → Hub → loa.", 24, False, BLUE)
text(100, 1680, "Theo mã nguồn vietfuture • 29/10/2026 • Bản prototype", 21, False, GRAY)
text(100, 1710, "Nhận thông báo cần có kết nối và cấu hình trình duyệt phù hợp.", 21, False, GRAY)

image.save(OUT / "LUMO_HARDWARE_FLOW_A4.png", dpi=(300, 300))
svg.append("</svg>")
(OUT / "LUMO_HARDWARE_FLOW_A4.svg").write_text("\n".join(svg), encoding="utf-8")
image.resize((868, 1228), Image.Resampling.LANCZOS).save(OUT / "LUMO_HARDWARE_FLOW_A4_preview.png")
print("A4 portrait: 2480 × 3508 px, 300 DPI. Body text: 10.6–11.5 pt.")
