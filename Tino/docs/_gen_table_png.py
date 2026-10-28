"""Generate comparison tables as PNG (single image, all 4 tables)."""
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import textwrap

fig, ax = plt.subplots(figsize=(20, 24), dpi=180)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.set_aspect('auto')
ax.axis('off')

C = {
    'edge_hdr':   '#10B981',
    'edge_row':   '#ECFDF5',
    'cloud_hdr':  '#F59E0B',
    'cloud_row':  '#FEF3C7',
    'data_hdr':   '#EC4899',
    'data_row':   '#FCE7F3',
    'cmp_hdr':    '#6366F1',
    'cmp_row':    '#EEF2FF',
    'goal':       '#D1FAE5',
    'border':     '#374151',
    'title':      '#1F2937',
    'sub':        '#6B7280',
}

def title(y, txt, color='#1F2937', fs=20, fw='bold'):
    ax.text(50, y, txt, ha='center', va='center', fontsize=fs, fontweight=fw, color=color)

def section(y, txt, color):
    ax.text(2, y, txt, ha='left', va='center', fontsize=14, fontweight='bold', color=color)

def table_block(y, headers, rows, hdr_color, row_color, col_widths, row_height=2.4):
    """y is bottom Y of the table."""
    x = 2
    total_w = sum(col_widths)
    # headers
    hdr_y = y + len(rows) * row_height + row_height
    cx = x
    for i, h in enumerate(headers):
        box(cx, hdr_y, col_widths[i], row_height,
            fc=hdr_color, ec=C['border'], label=h, fs=10.5, fw='bold', tc='white')
        cx += col_widths[i]
    # rows
    for r_idx, row in enumerate(rows):
        cy = y + (len(rows) - 1 - r_idx) * row_height
        cx = x
        for c_idx, cell in enumerate(row):
            bg = row_color
            if c_idx == 3:  # ngưỡng đạt highlight
                bg = C['goal']
            bold = c_idx == 0 or (c_idx == 2 and 'CHỌN' in str(cell))
            box(cx, cy, col_widths[c_idx], row_height,
                fc=bg, ec=C['border'], label=str(cell), fs=8.5,
                fw='bold' if bold else 'normal')
            cx += col_widths[c_idx]

def box(x, y, w, h, fc, ec, label, fs=9, fw='normal', tc='#1F2937', pad=0.15):
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad={pad},rounding_size=0.2",
                       linewidth=0.8, edgecolor=ec, facecolor=fc)
    ax.add_patch(p)
    # word-wrap
    char_w = max(1, int(w * 1.4))
    wrapped = '\n'.join(textwrap.wrap(label, width=char_w))
    ax.text(x + w/2, y + h/2, wrapped, ha='center', va='center',
            fontsize=fs, fontweight=fw, color=tc)

# ============ TITLE ============
title(98, 'BẢNG SO SÁNH CÁC PHƯƠNG PHÁP & TIÊU CHÍ ĐÁNH GIÁ HỆ THỐNG TINO',
      C['title'], 18)
title(96, 'Chương 12 — Hướng phát triển, hoàn thiện và khả năng ứng dụng',
      C['sub'], 11, 'normal')
ax.text(50, 95.2, '────────────────────────────────────────────────────────────────────────────',
        ha='center', va='center', color='#E5E7EB', fontsize=8)

# ============ TABLE 1: EDGE ============
section(93.5, '1. Tầng EDGE (ESP32-S3) — Wake-word, Audio, BLE, TTS Local',
        C['edge_hdr'])

t1 = [
    ('Wake-word "Tino ơi"',
     'Keyword spotting trên MCU, model ~250KB',
     'Prec/Recall, FAR/giờ, latency',
     'Prec ≥95%, FAR<1/h, <50ms'),
    ('Audio Capture (PDM/I2S)',
     'Thu 16kHz mono + VAD',
     'SNR, VAD Prec, MB upload/giờ',
     'SNR>20dB, Prec≥90%, <5MB/h'),
    ('BLE 5.0 (sensor mesh)',
     'Cửa · PIR · gas · button · IR',
     'RSSI ổn định, PER, pin',
     'PER<1%, pin>12 tháng'),
    ('TTS Local (Piper)',
     'Synthesize giọng Việt offline',
     'MOS, RTF, flash footprint',
     'MOS≥3.5/5, RTF<0.5, <4MB'),
    ('OTA + Watchdog',
     'Update firmware an toàn, rollback',
     'Success rate, RTO',
     'Success≥99%, RTO<5 phút'),
]
table_block(y=78, headers=['Phương pháp', 'Mô tả', 'Tiêu chí', 'Ngưỡng đạt'],
            rows=t1, hdr_color=C['edge_hdr'], row_color=C['edge_row'],
            col_widths=[24, 32, 24, 18], row_height=2.6)

# ============ TABLE 2: CLOUD ============
section(75, '2. Tầng CLOUD — STT, LLM, Device Registry, Alert, Auth',
        C['cloud_hdr'])

t2 = [
    ('STT (Whisper VN fine-tune)',
     'Audio → text VN có dấu, 3 miền',
     'WER, latency p95, acc giọng',
     'WER≤12%, p95<1s'),
    ('LLM VN (intent → JSON)',
     'Hiểu lệnh tự nhiên, RAG',
     'Intent-acc, Hallu, latency',
     'Intent≥90%, Hallu<5%, <1.5s'),
    ('Device Registry + IoT',
     'Auto-discovery BLE/Wi-Fi/IR',
     'Pair time, cmd success',
     'Pair<10s, success≥99%'),
    ('Auth + Family',
     'JWT + voice fingerprint',
     'Login p95, FAR/FRR voice',
     '<300ms, FAR<0.1%, FRR<1%'),
    ('Alert + Notification',
     'Push/email/SMS khi gas/cửa',
     'Delivery, E2E latency',
     '≥99%, p95<5s'),
]
table_block(y=60, headers=['Phương pháp', 'Mô tả', 'Tiêu chí', 'Ngưỡng đạt'],
            rows=t2, hdr_color=C['cloud_hdr'], row_color=C['cloud_row'],
            col_widths=[24, 32, 24, 18], row_height=2.6)

# ============ TABLE 3: DATA + OPS ============
section(57, '3. Tầng DATA / VẬN HÀNH — Storage, Monitoring, Thương mại',
        C['data_hdr'])

t3 = [
    ('PostgreSQL + Redis',
     'User/device/logs + cache',
     'Query p95, hit-rate, uptime',
     'p95<50ms, hit≥80%, ≥99.5%'),
    ('MinIO / S3 (audio clip)',
     'Lưu audio training, 30 ngày',
     'Durability, chi phí/GB',
     '99.999%, <300đ/GB/tháng'),
    ('Prometheus + Grafana',
     'Metric latency/cost/error',
     'MTTR, alert Prec/Recall',
     'MTTR<30ph, Prec≥90%'),
    ('Thương mại Freemium',
     'Hub 1 lần + Cloud + B2B',
     'ARPU, churn, conversion',
     'ARPU≥70K/th, churn<5%'),
    ('OSS + Cộng đồng',
     'FW + Cloud + App (MIT/Apache)',
     'Stars, contributors, PR',
     '≥500★, ≥10 người, 5PR/tuần'),
]
table_block(y=42, headers=['Phương pháp', 'Mô tả', 'Tiêu chí', 'Ngưỡng đạt'],
            rows=t3, hdr_color=C['data_hdr'], row_color=C['data_row'],
            col_widths=[24, 32, 24, 18], row_height=2.6)

# ============ TABLE 4: SO SÁNH 3 PHƯƠNG ÁN ============
section(39, '4. So sánh tổng hợp — 3 phương án triển khai',
        C['cmp_hdr'])

t4 = [
    ('Latency voice-to-action',  '> 1.5 s (phụ thuộc mạng)', '0.5–1.5 s',   '< 0.5 s'),
    ('Chi phí Cloud / tháng',    'Cao 10–20 USD/hộ',         'Thấp 3–5 USD',  '0 (offline)'),
    ('Yêu cầu Internet',        'Bắt buộc',                  'Không bắt buộc',  'Không cần'),
    ('Khả năng mở rộng tính năng','Rất cao',                  'Cao',           'Thấp (giới hạn MCU)'),
    ('Bảo mật / Riêng tư',      'Trung bình',                'Cao',           'Rất cao'),
    ('Phức tạp triển khai',     'Thấp',                      'Trung bình',    'Cao'),
    ('Phù hợp với TINO',        'Không (sai triết lý)',      '✓ CHỌN',        'Có nhưng giới hạn'),
]
# Custom render for table 4 — wider 3-col layout
hdrs = ['Tiêu chí', 'A: All-Cloud', 'B: Hybrid (CHỌN)', 'C: All-Local']
col_w = [25, 23, 24, 24]
row_h = 2.5
y_bot = 21
# headers
x = 2
cx = x
for i, h in enumerate(hdrs):
    box(cx, y_bot + len(t4)*row_h + row_h, col_w[i], row_h,
        fc=C['cmp_hdr'], ec=C['border'], label=h, fs=10.5, fw='bold', tc='white')
    cx += col_w[i]
# rows
for r_idx, row in enumerate(t4):
    cy = y_bot + (len(t4) - 1 - r_idx) * row_h
    cx = x
    for c_idx, cell in enumerate(row):
        bg = C['cmp_row']
        if c_idx == 2 and 'CHỌN' in cell:
            bg = C['goal']
        bold = c_idx == 0 or 'CHỌN' in cell
        box(cx, cy, col_w[c_idx], row_h,
            fc=bg, ec=C['border'], label=cell, fs=9.5,
            fw='bold' if bold else 'normal')
        cx += col_w[c_idx]

# ============ KẾT LUẬN ============
ax.text(2, 18, '▌ KẾT LUẬN', ha='left', va='center',
        fontsize=14, fontweight='bold', color='#1F2937')

conclusion = (
    'Hệ thống TINO được đánh giá theo 3 tầng (Edge / Cloud / Data) với hơn 15 chỉ số định lượng\n'
    '(latency, WER, MOS, Precision/Recall, ARPU, churn…). Phương án B — Hybrid là lựa chọn\n'
    'cân bằng giữa latency thấp, chi phí hợp lý, bảo mật dữ liệu và khả năng mở rộng AI.\n'
    'Mã nguồn mở (MIT/Apache 2.0) cho phép cộng đồng đóng góp, đẩy nhanh tốc độ hoàn thiện.'
)
ax.text(50, 14, conclusion, ha='center', va='center',
        fontsize=11, color='#1F2937',
        bbox=dict(boxstyle='round,pad=0.8', fc='#F9FAFB', ec='#D1D5DB'))

# Footer
ax.text(50, 4,
        'TINO — Trợ lý AI gia đình Việt · Offline-first · Open-source',
        ha='center', va='center', fontsize=10, fontstyle='italic',
        color=C['sub'])
ax.text(50, 2,
        'Edge (ESP32-S3) · Cloud (FastAPI) · Data (PG/Redis/S3) · OSS Community',
        ha='center', va='center', fontsize=9, fontstyle='italic',
        color=C['sub'])

plt.tight_layout()
out = r'c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\TINO_COMPARISON_TABLE.png'
plt.savefig(out, dpi=180, bbox_inches='tight', facecolor='white')
print('Saved:', out)
