"""Format technical pages (page 2+) of the TINO project report.
- Page 1 is preserved (P[0..22] + T[0]).
- From P[23] "NỘI DUNG HỒ SƠ DỰ ÁN" onward:
    * Body: Times New Roman 11pt, line spacing 1.5, justified, first-line indent 0.75cm.
    * Major headings (1., 2., ... 13.): Heading 1, 14pt bold.
    * Sub-headings (1.1, 1.2, ...): Heading 2, 12pt bold.
    * Tables: Table Grid borders, header row bold + centered.
    * Captions: "Bảng X.Y — ..." inserted BEFORE each table.
"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.table import Table

TARGET = r'Tino\TINO - Robot AI tiện lợi.docx'
doc = Document(TARGET)

# ---------- helpers ----------
SEC_RE   = re.compile(r'^\s*(\d{1,2})\.\s+\S')
SUB_RE   = re.compile(r'^\s*(\d{1,2})\.(\d{1,2})\s+\S')
SUBSUB_RE = re.compile(r'^\s*(\d{1,2})\.(\d{1,2})\.(\d{1,2})\s+\S')

def set_run_font(run, name='Times New Roman'):
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.insert(0, rFonts)
    for k in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        rFonts.set(qn(k), name)

def apply_para_style(p, style_name, *, font_size_pt=None, bold=None,
                     color=None, align=None, space_before=None, space_after=None,
                     first_line_indent_cm=None, line_spacing=1.5):
    p.style = doc.styles[style_name]
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    if space_before is not None:
        pf.space_before = Pt(space_before)
    if space_after is not None:
        pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if first_line_indent_cm is None:
        if style_name.startswith('Heading'):
            pf.first_line_indent = Cm(0)
        else:
            pf.first_line_indent = Cm(0.75)
    else:
        pf.first_line_indent = Cm(first_line_indent_cm)
    for run in p.runs:
        run.font.name = 'Times New Roman'
        set_run_font(run)
        if font_size_pt is not None:
            run.font.size = Pt(font_size_pt)
        if bold is not None:
            run.font.bold = bold
        if color is not None:
            run.font.color.rgb = color

# ---------- 1) styles ----------
styles = doc.styles

def ensure_pstyle(name, base, *, font_name='Times New Roman', size_pt=11, bold=False, color=None,
                  align=None, space_before=0, space_after=6, line_spacing=1.5,
                  first_line_indent_cm=None, keep_with_next=False):
    if name in styles:
        s = styles[name]
    else:
        s = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        s.base_style = styles[base] if base in styles else styles['Normal']
    f = s.font
    f.name = font_name
    f.size = Pt(size_pt)
    f.bold = bold
    if color is not None:
        f.color.rgb = color
    rPr = s.element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.insert(0, rFonts)
    for k in ('w:ascii','w:hAnsi','w:eastAsia','w:cs'):
        rFonts.set(qn(k), font_name)
    pf = s.paragraph_format
    if align is not None: pf.alignment = align
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if first_line_indent_cm is not None:
        pf.first_line_indent = Cm(first_line_indent_cm)
    if keep_with_next:
        pf.keep_with_next = True
    return s

ensure_pstyle('Normal', 'Normal', font_name='Times New Roman', size_pt=11,
              line_spacing=1.5, first_line_indent_cm=0.75, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
ensure_pstyle('Heading 1', 'Heading 1', size_pt=14, bold=True, color=RGBColor(0x1F, 0x3A, 0x5F),
              align=WD_ALIGN_PARAGRAPH.LEFT, space_before=14, space_after=6,
              line_spacing=1.5, first_line_indent_cm=0, keep_with_next=True)
ensure_pstyle('Heading 2', 'Heading 2', size_pt=12, bold=True, color=RGBColor(0x1F, 0x3A, 0x5F),
              align=WD_ALIGN_PARAGRAPH.LEFT, space_before=10, space_after=4,
              line_spacing=1.5, first_line_indent_cm=0, keep_with_next=True)
# Force-include Table Grid style definition if missing (built-in Word style)
if 'Table Grid' not in styles:
    s = styles.add_style('Table Grid', WD_STYLE_TYPE.TABLE)
    s.base_style = styles['Normal Table'] if 'Normal Table' in styles else None
ensure_pstyle('Heading 3', 'Heading 3', size_pt=11, bold=True, color=RGBColor(0x1F, 0x3A, 0x5F),
              align=WD_ALIGN_PARAGRAPH.LEFT, space_before=6, space_after=2,
              line_spacing=1.5, first_line_indent_cm=0, keep_with_next=True)
ensure_pstyle('Caption', 'Caption', size_pt=10, bold=True,
              align=WD_ALIGN_PARAGRAPH.LEFT, space_before=4, space_after=2,
              line_spacing=1.15, first_line_indent_cm=0)

# ---------- 2) find page-2 anchor ----------
body_elems = list(doc.element.body.iterchildren())
p2_start_idx = None
for i, el in enumerate(body_elems):
    if el.tag == qn('w:p'):
        txt = ''.join(t.text or '' for t in el.iter(qn('w:t')))
        if 'NỘI DUNG HỒ SƠ DỰ ÁN' in txt:
            p2_start_idx = i
            break
if p2_start_idx is None:
    raise RuntimeError('page-2 anchor not found')

print(f'page-2 starts at body element idx {p2_start_idx}')

# ---------- 3) walk page 2 ----------
heading_changes = {'h1': 0, 'h2': 0, 'h3': 0, 'body': 0}
current_section = 0

# table counter
table_seq_in_sec = {}

def describe_table(tbl_el):
    rows = list(tbl_el.findall(qn('w:tr')))
    if not rows:
        return 'Bảng chỉ tiêu'
    cells = rows[0].findall(qn('w:tc'))
    headers = []
    for c in cells:
        text = ''.join(t.text or '' for t in c.iter(qn('w:t'))).strip()
        if text:
            headers.append(text)
    return ' | '.join(headers)[:80] or 'Bảng chỉ tiêu'

def style_table(tbl):
    tbl.style = doc.styles['Table Grid']
    tblPr = tbl._tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl._tbl.insert(0, tblPr)
    existing = tblPr.find(qn('w:tblBorders'))
    if existing is not None:
        tblPr.remove(existing)
    borders = OxmlElement('w:tblBorders')
    for b in ('top','left','bottom','right','insideH','insideV'):
        be = OxmlElement(f'w:{b}')
        be.set(qn('w:val'), 'single')
        be.set(qn('w:sz'), '6')
        be.set(qn('w:color'), '000000')
        borders.append(be)
    tblPr.append(borders)
    if len(tbl.rows) >= 1:
        row = tbl.rows[0]
        trPr = row._tr.get_or_add_trPr()
        if trPr.find(qn('w:tblHeader')) is None:
            trPr.append(OxmlElement('w:tblHeader'))
        for cell in row.cells:
            for p in cell.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    run.font.bold = True
                    set_run_font(run)
                    if run.font.size is None:
                        run.font.size = Pt(11)

def insert_caption_before(elem, caption_text):
    parent = elem.getparent()
    idx = list(parent).index(elem)
    new_p = OxmlElement('w:p')
    parent.insert(idx, new_p)
    pPr = OxmlElement('w:pPr'); new_p.append(pPr)
    pStyle = OxmlElement('w:pStyle'); pStyle.set(qn('w:val'), 'Caption'); pPr.append(pStyle)
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), '60'); spacing.set(qn('w:after'), '120')
    pPr.append(spacing)
    r = OxmlElement('w:r'); new_p.append(r)
    rPr = OxmlElement('w:rPr'); r.append(rPr)
    rFonts = OxmlElement('w:rFonts')
    for k in ('w:ascii','w:hAnsi','w:eastAsia','w:cs'):
        rFonts.set(qn(k), 'Times New Roman')
    rPr.append(rFonts)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), '20'); rPr.append(sz)
    b = OxmlElement('w:b'); rPr.append(b)
    t = OxmlElement('w:t'); t.text = caption_text; r.append(t)

def current_section_at(idx, body_elems):
    sec = 0
    for j in range(idx - 1, -1, -1):
        el = body_elems[j]
        if el.tag == qn('w:p'):
            style_el = el.find(f'.//{qn("w:pStyle")}')
            if style_el is not None and style_el.get(qn('w:val')) == 'Heading1':
                txt = ''.join(t.text or '' for t in el.iter(qn('w:t')))
                m = SEC_RE.match(txt.strip())
                if m:
                    return int(m.group(1))
    return 0

# PASS A: style paragraphs only (no caption insert yet, to avoid index shift)
for k in range(p2_start_idx, len(body_elems)):
    el = body_elems[k]
    if el.tag == qn('w:p'):
        p = Paragraph(el, doc.part)
        txt = p.text.strip()
        if 'NỘI DUNG HỒ SƠ DỰ ÁN' in txt:
            apply_para_style(p, 'Heading 1', font_size_pt=14, bold=True,
                             color=RGBColor(0x1F, 0x3A, 0x5F),
                             align=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=6, space_after=12,
                             first_line_indent_cm=0)
            heading_changes['h1'] += 1
            continue
        if SUBSUB_RE.match(txt):
            apply_para_style(p, 'Heading 3', font_size_pt=11, bold=True,
                             color=RGBColor(0x1F, 0x3A, 0x5F),
                             space_before=6, space_after=2,
                             first_line_indent_cm=0)
            heading_changes['h3'] += 1
        elif SUB_RE.match(txt):
            apply_para_style(p, 'Heading 2', font_size_pt=12, bold=True,
                             color=RGBColor(0x1F, 0x3A, 0x5F),
                             space_before=10, space_after=4,
                             first_line_indent_cm=0)
            heading_changes['h2'] += 1
        elif SEC_RE.match(txt):
            apply_para_style(p, 'Heading 1', font_size_pt=14, bold=True,
                             color=RGBColor(0x1F, 0x3A, 0x5F),
                             space_before=14, space_after=6,
                             first_line_indent_cm=0)
            heading_changes['h1'] += 1
            current_section = int(SEC_RE.match(txt).group(1))
        else:
            if txt == '':
                apply_para_style(p, 'Normal', font_size_pt=11,
                                 space_before=0, space_after=2,
                                 first_line_indent_cm=0)
            else:
                apply_para_style(p, 'Normal', font_size_pt=11)
                heading_changes['body'] += 1
    elif el.tag == qn('w:tbl'):
        tbl = Table(el, doc.part)
        style_table(tbl)

# PASS B: insert captions before tables (re-read body)
body_elems = list(doc.element.body.iterchildren())
# re-find p2_start_idx
for i, el in enumerate(body_elems):
    if el.tag == qn('w:p'):
        txt = ''.join(t.text or '' for t in el.iter(qn('w:t')))
        if 'NỘI DUNG HỒ SƠ DỰ ÁN' in txt:
            p2_start_idx = i
            break

for k in range(p2_start_idx, len(body_elems)):
    el = body_elems[k]
    if el.tag == qn('w:tbl'):
        sec = current_section_at(k, body_elems)
        table_seq_in_sec[sec] = table_seq_in_sec.get(sec, 0) + 1
        idx_in_sec = table_seq_in_sec[sec]
        cap = f'Bảng {sec}.{idx_in_sec} — {describe_table(el)}'
        insert_caption_before(el, cap)

doc.save(TARGET)
print(f'\nSAVED -> {TARGET}')
print('Stats:', heading_changes)
print('Tables captioned:', sum(table_seq_in_sec.values()))
print('Per section:', dict(table_seq_in_sec))
