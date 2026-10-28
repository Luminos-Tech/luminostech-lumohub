import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document

path = r"c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\_backup\ThongtinNhom_AI2026_TINO_DRAFT_ORIGINAL.docx"
doc = Document(path)

# Print paragraphs 28-40 (section 1.2)
print("=" * 70)
print("SECTION 1.2 - Lý do lựa chọn vấn đề (paragraphs 28-40)")
print("=" * 70)

for i, p in enumerate(doc.paragraphs[28:42], start=28):
    text = p.text.strip()
    print(f"[{i}] [{p.style.name}] {text}")
    print("-" * 70)
