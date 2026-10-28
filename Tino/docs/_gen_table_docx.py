"""
Generate so sánh các phương pháp + tiêu chí đánh giá
cho hệ thống TINO → file .docx để chèn vào Word
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def set_cell_bg(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tc_pr.append(shd)


def add_borders(table):
    tbl = table._tbl
    tbl_pr = tbl.tblPr if tbl.tblPr is not None else tbl.get_or_add_tblPr()
    borders = OxmlElement('w:tblBorders')
    for b in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{b}')
        e.set(qn('w:val'), 'single')
        e.set(qn('w:sz'), '6')
        e.set(qn('w:color'), '374151')
        borders.append(e)
    tbl_pr.append(borders)


def fill(row_idx, cells_data, doc, table, head=False):
    """cells_data: list of (text, color or None, bold?)"""
    row = table.rows[row_idx]
    for i, (text, bg, bold) in enumerate(cells_data):
        cell = row.cells[i]
        cell.text = ''
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(9)
        run.font.bold = bool(bold) or head
        if head:
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if bg:
            set_cell_bg(cell, bg)


def section(title, doc, color='3B82F6'):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run(title)
    r.font.size = Pt(13)
    r.font.bold = True
    r.font.color.rgb = RGBColor.from_string(color)


doc = Document()

# === Page setup A4 landscape nhỏ ===
section_ = doc.sections[0]
section_.page_height = Cm(20)
section_.page_width = Cm(30)
section_.orientation = 1  # landscape
section_.left_margin = Cm(1.5)
section_.right_margin = Cm(1.5)
section_.top_margin = Cm(1.5)
section_.bottom_margin = Cm(1.5)

# === Title ===
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('BẢNG SO SÁNH CÁC PHƯƠNG PHÁP & TIÊU CHÍ ĐÁNH GIÁ HỆ THỐNG TINO')
r.font.size = Pt(16)
r.font.bold = True
r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Chương 12 — Hướng phát triển, hoàn thiện và khả năng ứng dụng')
r.font.size = Pt(11)
r.font.italic = True
r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

doc.add_paragraph()

# ============ BẢNG 1: EDGE — AI/WAKE/STT-TTS LOCAL ============
section('1. Tầng EDGE (ESP32-S3) — Wake-word, Audio, TTS Local', doc, '10B981')

table = doc.add_table(rows=1, cols=5)
table.autofit = False
hdr = ['Phương pháp / Công nghệ', 'Mô tả', 'Tiêu chí đánh giá', 'Ngưỡng đạt', 'Công cụ đo']
fill(0, [
    ('Phương pháp / Công nghệ', '10B981', True),
    ('Mô tả',                        '10B981', True),
    ('Tiêu chí đánh giá',            '10B981', True),
    ('Ngưỡng đạt',                   '10B981', True),
    ('Công cụ đo',                   '10B981', True),
], doc, table, head=True)

edge_rows = [
    ('Wake-word "Tino ơi"',
     'Keyword spotting trên MCU, model nhỏ ~250KB',
     'Precision, Recall, False-accept/giờ, Latency',
     'Prec ≥ 95%, FAR < 1/h, Latency < 50 ms',
     'Edge Impulse · logs MCU · script tái test 1000 lần'),

    ('Audio Capture (PDM/I2S)',
     'Thu âm 16 kHz mono, VAD trước khi upload',
     'SNR, VAD Recall/Prec, dung lượng upload/giờ',
     'SNR > 20 dB, VAD Prec ≥ 90%, < 5 MB/h',
     'Scopy · Audacity · Wireshark'),

    ('BLE 5.0 (Sensor & cmd)',
     'Mesh BLE tới sensor cửa/PIR/gas/button',
     'RSSI ổn định, tỉ lệ mất gói, thời lượng pin',
     'PER < 1%, pin > 12 tháng (CR2032)',
     'nRF Connect · BLE sniffer'),

    ('TTS Local (Piper)',
     'Synthesize tiếng Việt offline (cache câu hay)',
     'MOS (Mean Opinion Score), RTF, dung lượng flash',
     'MOS ≥ 3.5/5, RTF < 0.5, flash < 4 MB',
     'Đánh giá 20 người nghe · benchmark CPU'),

    ('OTA + Watchdog',
     'Cập nhật firmware an toàn, tự rollback',
     'Tỉ lệ update thành công, thời gian hồi phục',
     'Success ≥ 99%, RTO < 5 phút',
     'ESP-IDF ota_app · logs cloud'),
]

for i, row in enumerate(edge_rows, start=1):
    table.add_row()
    fill(i, [
        (row[0], 'ECFDF5', True),
        (row[1], None, False),
        (row[2], None, False),
        (row[3], 'FEF3C7', True),
        (row[4], None, False),
    ], doc, table)

add_borders(table)

doc.add_paragraph()

# ============ BẢNG 2: CLOUD — STT/LLM/COMMAND ============
section('2. Tầng CLOUD — STT, LLM, Device Registry, Alert', doc, 'F59E0B')

table = doc.add_table(rows=1, cols=5)
table.autofit = False
fill(0, [
    ('Phương pháp / Công nghệ', 'F59E0B', True),
    ('Mô tả',                   'F59E0B', True),
    ('Tiêu chí đánh giá',       'F59E0B', True),
    ('Ngưỡng đạt',              'F59E0B', True),
    ('Công cụ đo',              'F59E0B', True),
], doc, table, head=True)

cloud_rows = [
    ('STT (Whisper VN fine-tune)',
     'Audio → text tiếng Việt có dấu, 3 miền Bắc–Trung–Nam',
     'WER (Word Error Rate), latency p95, acc giọng địa phương',
     'WER ≤ 12%, p95 < 1.0 s, đạt 3 miền',
     'Whisper eval · JiWER · dataset nội bộ 50h'),

    ('LLM tiếng Việt (VN-LLM)',
     'Hiểu lệnh tiếng Việt tự nhiên + JSON intent',
     'Intent-accuracy, BLEU/ROUGE, hallucination rate, latency',
     'Intent ≥ 90%, Hallu < 5%, p95 < 1.5 s',
     'Bộ test 200 câu · Langfuse · Prometheus'),

    ('Device Registry / IoT',
     'Quản lý thiết bị BLE/Wi-Fi/IR, auto-discovery',
     'Discovery-time, success-pair, command-success',
     'Pair < 10 s, cmd success ≥ 99%',
     'Locust load test · logs Prometheus'),

    ('Auth + Multi-user Family',
     'JWT + phân quyền theo thành viên, voice fingerprint',
     'Auth-success, FAR/FRR voice ID, latency login',
     'Login p95 < 300 ms, FAR < 0.1%, FRR < 1%',
     'OWASP ZAP · script đo voice'),

    ('Alert & Notification',
     'Push, email, SMS khi gas/smoke/cửa mở',
     'Delivery-rate, end-to-end latency, false alarm',
     'Delivery ≥ 99%, p95 < 5 s, FAR < 1%/ngày',
     'FCM panel · logs Prometheus'),
]

for i, row in enumerate(cloud_rows, start=1):
    table.add_row()
    fill(i, [
        (row[0], 'FEF3C7', True),
        (row[1], None, False),
        (row[2], None, False),
        (row[3], 'DBEAFE', True),
        (row[4], None, False),
    ], doc, table)

add_borders(table)

doc.add_paragraph()

# ============ BẢNG 3: DATA + DEVOPS + KINH DOANH ============
section('3. Tầng DATA / VẬN HÀNH — Storage, Monitoring, Thương mại', doc, 'EC4899')

table = doc.add_table(rows=1, cols=5)
table.autofit = False
fill(0, [
    ('Phương pháp / Công nghệ', 'EC4899', True),
    ('Mô tả',                   'EC4899', True),
    ('Tiêu chí đánh giá',       'EC4899', True),
    ('Ngưỡng đạt',              'EC4899', True),
    ('Công cụ đo',              'EC4899', True),
], doc, table, head=True)

data_rows = [
    ('PostgreSQL + Redis',
     'Lưu user/device/logs, cache session/voice',
     'Query p95, hit-rate, downtime/tháng',
     'p95 < 50 ms, hit ≥ 80%, uptime ≥ 99.5%',
     'pgbench · redis-cli · Grafana'),

    ('MinIO / S3 (audio clip)',
     'Lưu audio cho training, 30 ngày retention',
     'Tỉ lệ mất dữ liệu, chi phí/GB/tháng',
     'Durability ≥ 99.999%, < 300đ/GB/tháng',
     'mc (MinIO client) · AWS calculator'),

    ('Prometheus + Grafana',
     'Metric latency, error, cost · dashboard mẫu',
     'Cardinality, MTTR, alert precision/recall',
     'MTTR < 30 phút, alert Prec ≥ 90%',
     'PromQL · Alertmanager · Grafana'),

    ('Mô hình thương mại',
     'Hub bán 1 lần + Cloud Freemium + B2B',
     'GMV, ARPU, churn, conversion free→premium',
     'ARPU ≥ 70K/tháng, churn < 5%/tháng',
     'Bảng tính · cohort analysis'),

    ('Mã nguồn mở & Cộng đồng',
     'Phát hành FW + Cloud + App (MIT/Apache 2.0)',
     'Stars, contributors, issues closed/ngày',
     '≥ 500 stars, ≥ 10 contributors, 5 PR/tuần',
     'GitHub API · Discord activity'),
]

for i, row in enumerate(data_rows, start=1):
    table.add_row()
    fill(i, [
        (row[0], 'FCE7F3', True),
        (row[1], None, False),
        (row[2], None, False),
        (row[3], 'D1FAE5', True),
        (row[4], None, False),
    ], doc, table)

add_borders(table)

doc.add_paragraph()

# ============ BẢNG 4: ĐÁNH GIÁ TỔNG HỢP — SO SÁNH 3 PHƯƠNG ÁN ============
section('4. So sánh tổng hợp — 3 phương án triển khai', doc, '6366F1')

table = doc.add_table(rows=1, cols=4)
table.autofit = False
fill(0, [
    ('Tiêu chí',           '6366F1', True),
    ('Phương án A: All-Cloud', '6366F1', True),
    ('Phương án B: Hybrid (chọn)', '6366F1', True),
    ('Phương án C: All-Local',  '6366F1', True),
], doc, table, head=True)

cmp_rows = [
    ('Latency voice-to-action', '> 1.5 s (phụ thuộc mạng)', '0.5–1.5 s', '< 0.5 s'),
    ('Chi phí Cloud / tháng',   'Cao (10–20 USD/hộ)',         'Thấp (3–5 USD/hộ)', '0 (offline)'),
    ('Yêu cầu Internet',       'Bắt buộc',                   'Không bắt buộc (offline cho lệnh cơ bản)', 'Không cần'),
    ('Khả năng mở rộng tính năng', 'Rất cao',                'Cao',                'Thấp (giới hạn MCU)'),
    ('Bảo mật / Riêng tư',     'Trung bình (data ra cloud)',  'Cao (lệnh nhạy ở local)', 'Rất cao'),
    ('Độ phức tạp triển khai', 'Thấp',                       'Trung bình',         'Cao'),
    ('Phù hợp với TINO',       'Không (sai triết lý)',       '✓ CHỌN',            'Có nhưng giới hạn'),
]
for i, row in enumerate(cmp_rows, start=1):
    table.add_row()
    bg = 'D1FAE5' if 'CHỌN' in row[2] else None
    fill(i, [
        (row[0], 'EEF2FF', True),
        (row[1], None, False),
        (row[2], bg, 'CHỌN' in row[2]),
        (row[3], None, False),
    ], doc, table)

add_borders(table)

doc.add_paragraph()

# ============ KẾT LUẬN ============
section('Kết luận', doc, '1F2937')
p = doc.add_paragraph()
r = p.add_run(
    'Hệ thống TINO đánh giá theo 3 tầng (Edge / Cloud / Data) với hơn 15 chỉ số '
    'định lượng (latency, WER, MOS, Precision/Recall, ARPU, churn…). '
    'Phương án B — Hybrid (Edge xử lý wake-word + lệnh cơ bản; Cloud xử lý '
    'STT/LLM/TTS + quản trị đa thiết bị) được chọn vì cân bằng giữa: '
    'latency thấp, chi phí hợp lý, bảo mật dữ liệu và khả năng mở rộng AI. '
    'Mã nguồn mở cho phép cộng đồng đóng góp, đẩy nhanh tốc độ hoàn thiện '
    'từ MVP đến sản phẩm thương mại.'
)
r.font.size = Pt(11)

out = r'c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\TINO_COMPARISON_TABLE.docx'
doc.save(out)
print('Saved:', out)
