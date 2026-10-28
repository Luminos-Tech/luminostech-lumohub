import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document
from docx.oxml.ns import qn

target = r'Tino\TINO - Robot AI tiện lợi.docx'
doc = Document(target)

# Print first 6 paragraphs (page 1) + paragraphs from P023 onward (page 2)
# Show current font + alignment + style
for i, p in enumerate(doc.paragraphs):
    if i < 4 or 22 <= i <= 28:
        runs = p.runs
        if runs:
            r0 = runs[0]
            f = r0.font
            sz = f.size.pt if f.size else None
            print(f'[{i}] style={p.style.name!r} align={p.alignment} '
                  f'font={f.name!r} sz={sz} bold={f.bold} | text={p.text[:80]!r}')
        else:
            print(f'[{i}] style={p.style.name!r} align={p.alignment} | (no runs) text={p.text[:80]!r}')

# Find paragraph that starts page-2 content
print('\n--- Locate "NỘI DUNG HỒ SƠ DỰ ÁN" ---')
for i, p in enumerate(doc.paragraphs):
    if 'NỘI DUNG HỒ SƠ' in p.text or 'NỘI DUNG HỒ SƠ DỰ ÁN' in p.text:
        print(f'  found at P[{i}]: {p.text!r}')

# Check table style + caption existence
print('\n--- Tables ---')
for ti, tbl in enumerate(doc.tables):
    print(f'  T[{ti}] style={tbl.style.name!r} rows={len(tbl.rows)} cols={len(tbl.columns)}')

# Check section page settings
for i, sec in enumerate(doc.sections):
    print(f'\nsec[{i}] W={sec.page_width.cm:.2f}cm H={sec.page_height.cm:.2f}cm '
          f'margins L/R/T/B = {sec.left_margin.cm:.1f}/{sec.right_margin.cm:.1f}/{sec.top_margin.cm:.1f}/{sec.bottom_margin.cm:.1f}cm')
