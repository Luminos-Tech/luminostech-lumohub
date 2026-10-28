import sys, re
from docx import Document

path = r"c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\ThongtinNhom_AI2026_TINO_DRAFT_SHORT.docx"
doc = Document(path)

# Find section 1.1 and following
in_section = False
count = 0
for i, p in enumerate(doc.paragraphs):
    text = p.text.strip()
    if not text:
        continue
    # detect section start "1." or "1.1"
    if re.match(r"^1\.\s*M[ôo]\s*t[ảa]", text, re.I) or re.match(r"^1\.1\b", text):
        in_section = True
    if in_section:
        print(f"[{i}] [{p.style.name}] {text[:300]}")
        print()
        count += 1
    if count > 25:
        break
