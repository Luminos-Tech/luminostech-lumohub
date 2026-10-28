import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import docx
from docx import Document
from docx.oxml.ns import qn

target = r'Tino\TINO - Robot AI tiện lợi.docx'
out_path = r'Tino\docs\_inspect_out.txt'
doc = Document(target)

print('=== SECTIONS ===')
for i, sec in enumerate(doc.sections):
    print(f'sec[{i}] page={sec.page_width.cm:.1f}cm x {sec.page_height.cm:.1f}cm '
          f'L={sec.left_margin.cm:.1f} R={sec.right_margin.cm:.1f} '
          f'T={sec.top_margin.cm:.1f} B={sec.bottom_margin.cm:.1f}')

print()
print('=== TOTAL PARAGRAPHS ===', len(doc.paragraphs))
print('=== TOTAL TABLES ===', len(doc.tables))
print()

# Walk body & annotate pages by section breaks
from docx.oxml.ns import qn
f_out = open(out_path, 'w', encoding='utf-8')

body = doc.element.body
print('=== BODY CHILDREN SEQUENCE (para / table / sectPr / break) ===')
section_idx = 0
para_idx = 0
table_idx = 0
for child in body.iterchildren():
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        # find sectPr
        sectPr = child.find(qn('w:sectPr'))
        # find page break
        br = child.find(f'.//{qn("w:br")}')
        page_break = br is not None and br.get(qn('w:type')) == 'page'
        text = ''.join(t.text or '' for t in child.iter(qn('w:t')))[:120]
        marker = ''
        if sectPr is not None:
            marker += ' [SECT_BREAK]'
        if page_break:
            marker += ' [PAGE_BREAK]'
        line = f'P[{para_idx:03d}]{marker} | {text!r}'
        print(line); f_out.write(line + '\n')
        para_idx += 1
        if sectPr is not None:
            section_idx += 1
    elif tag == 'tbl':
        # get first row text
        rows = list(child.findall(qn('w:tr')))
        cells_text = []
        if rows:
            for tr in rows[:2]:
                cells_text.append(' | '.join(''.join(t.text or '' for t in tc.iter(qn('w:t')))[:30]
                                              for tc in tr.findall(qn('w:tc'))))
        line = f'T[{table_idx:02d}] table ({len(rows)} rows) -> {cells_text}'
        print(line); f_out.write(line + '\n')
        table_idx += 1
    elif tag == 'sectPr':
        line = '=== FINAL SECT_PR ==='
        print(line); f_out.write(line + '\n')
        section_idx += 1
    else:
        line = f'?{tag}'
        print(line); f_out.write(line + '\n')

print()
print('Final sections count =', section_idx+1)
print('Saved to', out_path)
f_out.close()
