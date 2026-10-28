"""Verify formatted docx: structure + styles after format script."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.oxml.ns import qn

TARGET = r'Tino\TINO - Robot AI tiện lợi.docx'
doc = Document(TARGET)

print('=== File integrity ===')
print(f'  paragraphs: {len(doc.paragraphs)}')
print(f'  tables    : {len(doc.tables)}')
print(f'  sections  : {len(doc.sections)}')

# Find anchor
for i, p in enumerate(doc.paragraphs):
    if 'NỘI DUNG HỒ SƠ DỰ ÁN' in p.text:
        print(f'\nAnchor P[{i}] style={p.style.name!r} align={p.alignment}')
        break

# Sample 8 paragraphs after anchor
print('\n=== Sample paragraphs (page 2+) ===')
shown = 0
for i in range(i, len(doc.paragraphs)):
    p = doc.paragraphs[i]
    runs = p.runs
    sz = runs[0].font.size.pt if runs and runs[0].font.size else None
    fname = runs[0].font.name if runs else None
    print(f'P[{i:3d}] style={p.style.name!r:<14} align={str(p.alignment):<25} '
          f'font={fname!r:<8} sz={sz} ind={p.paragraph_format.first_line_indent} '
          f'| {p.text[:70]!r}')
    shown += 1
    if shown >= 10:
        break

# Captions
print('\n=== Captions in body (Bảng/Hình) ===')
for i, p in enumerate(doc.paragraphs):
    if p.style.name == 'Caption':
        print(f'  P[{i}]: {p.text[:120]!r}')

# Tables: header style
print('\n=== Tables ===')
for ti, tbl in enumerate(doc.tables):
    print(f'  T[{ti}] style={tbl.style.name if tbl.style else None!r:<14} rows={len(tbl.rows)} cols={len(tbl.columns)}')

# Headings count
print('\n=== Headings count ===')
h1c = h2c = h3c = bodyc = 0
for p in doc.paragraphs:
    if p.style.name == 'Heading 1': h1c += 1
    elif p.style.name == 'Heading 2': h2c += 1
    elif p.style.name == 'Heading 3': h3c += 1
    elif p.style.name == 'Normal': bodyc += 1
print(f'  Heading 1: {h1c}, Heading 2: {h2c}, Heading 3: {h3c}, Normal: {bodyc}')

print('\nDONE')
