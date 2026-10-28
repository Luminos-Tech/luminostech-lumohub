import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from docx import Document

path = r"c:\Users\tyranno\Documents\Project\luminostech-lumohub\Tino\docs\_backup\ThongtinNhom_AI2026_TINO_DRAFT_ORIGINAL.docx"
doc = Document(path)

print("=" * 70)
print("TIM SECTIONS 1.1 / 1.2 / 1.3 + doan ban user trích")
print("=" * 70)

for i, p in enumerate(doc.paragraphs):
    text = p.text.strip()
    if not text:
        continue
    # bat section 1.x hoac chua "Mô t" "thực tiễn"
    if (re.match(r"^1\.", text) or
        re.match(r"^1\.[12345]", text) or
        "Mô t" in text[:50] or
        "thực tiễn" in text.lower() or
        "Tino ơi" in text or
        "điều khiển hàng chục" in text or
        "đèn, điều hòa" in text):
        print(f"[{i}] {text[:500]}")
        print("-" * 70)
