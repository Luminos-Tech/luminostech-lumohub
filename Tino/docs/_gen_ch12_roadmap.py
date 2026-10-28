"""
Generate PNG: Chương 12 — Hướng phát triển, hoàn thiện và khả năng ứng dụng
v2 — to hơn, thoáng hơn
"""
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle

fig, ax = plt.subplots(figsize=(20, 16), dpi=200)
ax.set_xlim(0, 120)
ax.set_ylim(0, 80)
ax.set_aspect('equal')
ax.axis('off')

C_DARK = '#1F2937'

def box(x, y, w, h, fc='#FFFFFF', ec='#374151', tc='#1F2937', pad=0.4):
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad={pad},rounding_size=0.8",
                       linewidth=1.5, edgecolor=ec, facecolor=fc)
    ax.add_patch(p)

def arrow(x1, y1, x2, y2, color='#374151', lw=2):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle='-|>',
                        color=color, lw=lw, mutation_scale=18)
    ax.add_patch(a)

# ========== TITLE ==========
ax.text(60, 77, 'CHƯƠNG 12 — HƯỚNG PHÁT TRIỂN, HOÀN THIỆN & ỨNG DỤNG',
        ha='center', va='center', fontsize=22, fontweight='bold', color='#1F2937')
ax.text(60, 74, 'Hoàn thiện sản phẩm · Mở rộng & duy trì · Tác động thực tiễn',
        ha='center', va='center', fontsize=12, fontstyle='italic', color='#6B7280')

# ========== ROADMAP ==========
box(2, 38, 116, 32, fc='#F9FAFB', ec=C_DARK)
ax.text(5, 67.5, 'ROADMAP — 3 GIAI ĐOẠN', ha='left', va='top',
        fontsize=14, fontweight='bold', color='#1F2937')

ax.annotate('', xy=(114, 62), xytext=(6, 62),
            arrowprops=dict(arrowstyle='<|-|>', color=C_DARK, lw=3))
ax.text(60, 63.5, 'Thời gian →', ha='center', va='bottom',
        fontsize=11, fontstyle='italic', color=C_DARK)

# STAGE 1 — NGẮN HẠN
s1x, s1y, s1w, s1h = 8, 41, 32, 18
box(s1x, s1y, s1w, s1h, fc='#DBEAFE', ec='#3B82F6')
ax.text(s1x+s1w/2, s1y+s1h-1.8, '12.1 — NGẮN HẠN',
        ha='center', va='top', fontsize=13, fontweight='bold', color='#1E40AF')
ax.text(s1x+s1w/2, s1y+s1h-3.3, '(6 – 12 tháng)',
        ha='center', va='top', fontsize=10, fontstyle='italic', color='#1E40AF')
ax.text(s1x+s1w/2, s1y+s1h-5.5,
        '• MVP hoàn thiện + pilot 5–10 hộ\n'
        '• Tối ưu LLM (latency, cost)\n'
        '• Mở rộng TV, máy rửa bát, tưới cây\n'
        '• API nhạc: Spotify, NhacCuaTui\n'
        '• Mobile app React Native (iOS+Android)\n'
        '• Hoàn thiện OTA + giám sát từ xa\n'
        '• Scene: tiệc · xem phim · gym · học',
        ha='center', va='top', fontsize=10, color='#1F2937')

# STAGE 2 — TRUNG HẠN
s2x, s2y, s2w, s2h = 44, 41, 34, 18
box(s2x, s2y, s2w, s2h, fc='#FEF3C7', ec='#F59E0B')
ax.text(s2x+s2w/2, s2y+s2h-1.8, '12.2 — TRUNG HẠN',
        ha='center', va='top', fontsize=13, fontweight='bold', color='#92400E')
ax.text(s2x+s2w/2, s2y+s2h-3.3, '(1 – 3 năm)',
        ha='center', va='top', fontsize=10, fontstyle='italic', color='#92400E')
ax.text(s2x+s2w/2, s2y+s2h-5.5,
        'AI mở rộng:\n'
        '• Dịch realtime VN ↔ EN/Zh/Ja\n'
        '• Voice fingerprint · nhớ sở thích\n'
        '• Lịch Google / Outlook\n\n'
        'Thị trường:\n'
        '• Indo, Filipino, Thái (200M+ dân)\n'
        '• B2B văn phòng · Trường: trợ lý học\n\n'
        'Mã nguồn mở:\n'
        '• FW + Cloud + App (MIT/Apache 2.0)\n'
        '• Dataset giọng Việt · bài báo AI VN',
        ha='center', va='top', fontsize=9.5, color='#1F2937')

# STAGE 3 — TÁC ĐỘNG
s3x, s3y, s3w, s3h = 82, 41, 32, 18
box(s3x, s3y, s3w, s3h, fc='#FCE7F3', ec='#EC4899')
ax.text(s3x+s3w/2, s3y+s3h-1.8, '12.3 — TÁC ĐỘNG',
        ha='center', va='top', fontsize=13, fontweight='bold', color='#9F1239')
ax.text(s3x+s3w/2, s3y+s3h-3.3, '& ỨNG DỤNG',
        ha='center', va='top', fontsize=10, fontstyle='italic', color='#9F1239')
ax.text(s3x+s3w/2, s3y+s3h-5.5,
        'Thị trường:\n'
        '• Smart home VN +30%/năm\n'
        '• Hub < 1tr + 200–500K/thiết bị\n\n'
        'Ứng dụng:\n'
        '• Gia đình: AI hiểu tiếng Việt\n'
        '• Văn phòng: ghi chép họp, nhắc lịch\n'
        '• Trường: tra đáp án, kể chuyện\n\n'
        'Thương mại:\n'
        '• Hub bán 1 lần + Cloud freemium',
        ha='center', va='top', fontsize=9.5, color='#1F2937')

# ========== HỆ SINH THÁI TÁC ĐỘNG ==========
box(2, 6, 68, 28, fc='#F0FDF4', ec='#10B981')
ax.text(5, 31.5, 'HỆ SINH THÁI TÁC ĐỘNG', ha='left', va='top',
        fontsize=14, fontweight='bold', color='#065F46')

core = Circle((36, 20), 5.5, facecolor='#10B981', edgecolor='#065F46', linewidth=2.5)
ax.add_patch(core)
ax.text(36, 20.7, 'TINO', ha='center', va='center',
        fontsize=16, fontweight='bold', color='white')
ax.text(36, 18.6, '(OSS Core)', ha='center', va='center',
        fontsize=10, color='white')

def stake(x, y, title, body, w=22):
    box(x, y, w, 7, fc='#FFFFFF', ec='#10B981')
    ax.text(x+w/2, y+7-1.2, title, ha='center', va='top',
            fontsize=11, fontweight='bold', color='#065F46')
    ax.text(x+w/2, y+7-2.8, body, ha='center', va='top',
            fontsize=9.5, color='#1F2937')

stake(5,  23, 'Gia đình Việt',
      'AI hiểu tiếng Việt,\nnhớ từng thành viên')
stake(45, 23, 'Trường học',
      'Trợ lý học tập:\ntra đáp án, kể chuyện, ôn')
stake(5,  9,  'Văn phòng / SME',
      'Ghi chép họp, nhắc lịch,\nđiều khiển AC / máy chiếu')
stake(45, 9,  'Đông Nam Á',
      'VN · Indo · Filipino · Thái\n(200M+ dân)')

for (sx, sy) in [(16, 26.5), (56, 26.5), (16, 12.5), (56, 12.5)]:
    arrow(36, 20, sx, sy, color='#10B981', lw=2)

# ========== MÔ HÌNH THƯƠNG MẠI ==========
box(74, 6, 44, 28, fc='#FEF3C7', ec='#F59E0B')
ax.text(77, 31.5, 'MÔ HÌNH THƯƠNG MẠI', ha='left', va='top',
        fontsize=14, fontweight='bold', color='#92400E')

# HW
box(76, 25, 40, 5, fc='#FDE68A', ec='#F59E0B')
ax.text(96, 28.5, 'PHẦN CỨNG — Hub bán 1 lần',
        ha='center', va='center', fontsize=11, fontweight='bold', color='#92400E')
ax.text(96, 26.5, 'Giá dự kiến < 1 triệu VNĐ',
        ha='center', va='center', fontsize=9.5, color='#1F2937')

# Cloud Freemium
box(76, 16.5, 40, 6, fc='#FDE68A', ec='#F59E0B')
ax.text(96, 21, 'CLOUD — Freemium',
        ha='center', va='center', fontsize=11, fontweight='bold', color='#92400E')
ax.text(77, 19.5, '✓ Free: IoT + giọng Việt + nhắc lịch',
        ha='left', va='top', fontsize=9, color='#1F2937')
ax.text(77, 18.0, '+ Premium 49–99K/tháng: dịch · nhạc · voice ID · RAG',
        ha='left', va='top', fontsize=9, color='#92400E', fontweight='bold')

# B2B
box(76, 8, 40, 4.5, fc='#FDE68A', ec='#F59E0B')
ax.text(96, 11, 'B2B LICENSE — Trường / Văn phòng',
        ha='center', va='center', fontsize=11, fontweight='bold', color='#92400E')
ax.text(96, 9.2, '(Báo giá theo seat)',
        ha='center', va='center', fontsize=9.5, color='#1F2937')

# ========== FOOTER ==========
ax.text(60, 3,
        'Triết lý: AI gia đình hiểu tiếng Việt · Offline-first · Open-source cho cộng đồng',
        ha='center', va='center', fontsize=11, fontstyle='italic', color='#6B7280')
ax.text(60, 0.5,
        'Tác động dự kiến: Smart home VN +30%/năm · Đẩy mạnh hệ sinh thái AI tiếng Việt',
        ha='center', va='center', fontsize=11, fontstyle='italic',
        color='#10B981', fontweight='bold')

plt.tight_layout()
out = r'c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\TINO_CH12_ROADMAP.png'
plt.savefig(out, dpi=200, bbox_inches='tight', facecolor='white')
print('Saved:', out)
