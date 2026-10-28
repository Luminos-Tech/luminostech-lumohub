# -*- coding: utf-8 -*-
"""
Generate: Bang ke khai AI tools, datasets, APIs, libraries, in-house components
Output: Tino/docs/Bang_ke_khai_cong_cu_AI.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os, sys

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PDF   = os.path.join(SCRIPT_DIR, "Bang_ke_khai_cong_cu_AI.pdf")

# Register Vietnamese font (use a fallback if not available)
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

font_paths = [
    ("C:/Windows/Fonts/arial.ttf",       "Arial"),
    ("C:/Windows/Fonts/arialbd.ttf",      "Arial-Bold"),
    ("C:/Windows/Fonts/times.ttf",        "Times-Roman"),
    ("C:/Windows/Fonts/timesbd.ttf",      "Times-Bold"),
]

for path, name in font_paths:
    if os.path.exists(path):
        try:
            pdfmetrics.registerFont(TTFont(name, path))
            print(f"  Registered font: {name} ({path})")
        except Exception as e:
            print(f"  Warning: could not register {path}: {e}")

# Use explicit font names (Arial is registered and supports bold via -Bold suffix)
FONT_NAME = "Arial"
FONT_BOLD = "Arial-Bold"

# ── Page setup ───────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
LEFT_M = RIGHT_M = 2.0 * cm
TOP_M  = 2.2 * cm
BOT_M  = 2.0 * cm

doc = SimpleDocTemplate(
    OUT_PDF,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M,   bottomMargin=BOT_M,
)

CONTENT_W = PAGE_W - LEFT_M - RIGHT_M   # usable width

# ── Styles ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, parent="Normal", **kw):
    return ParagraphStyle(name, parent=styles[parent], **kw)

s_title   = make_style("DocTitle",   fontSize=16, leading=20,
                        fontName=FONT_BOLD, alignment=TA_CENTER,
                        textColor=colors.HexColor("#1a3a6b"), spaceAfter=4)
s_sub     = make_style("DocSub",     fontSize=11, leading=14,
                        fontName=FONT_NAME, alignment=TA_CENTER,
                        textColor=colors.HexColor("#1a3a6b"), spaceAfter=2)
s_section = make_style("Section",    fontSize=12, leading=16,
                        fontName=FONT_BOLD,
                        textColor=colors.HexColor("#1a3a6b"),
                        spaceBefore=14, spaceAfter=6)
s_body    = make_style("Body",       fontSize=9.5, leading=14,
                        fontName=FONT_NAME, alignment=TA_JUSTIFY,
                        spaceAfter=4)
s_note    = make_style("Note",       fontSize=9,   leading=13,
                        fontName=FONT_NAME, textColor=colors.HexColor("#555555"),
                        spaceAfter=4)
s_footer  = make_style("Footer",     fontSize=8.5, leading=12,
                        fontName=FONT_NAME, alignment=TA_CENTER,
                        textColor=colors.HexColor("#888888"))

# ── Helpers ───────────────────────────────────────────────────────────────────
HDR_FILL  = colors.HexColor("#1a3a6b")
HDR_TEXT  = colors.white
ALT_FILL  = colors.HexColor("#eef2f8")
ROW_FILL  = colors.white

def cell(txt, bold=False, size=8.5, align=TA_LEFT, color=colors.black):
    fn = FONT_BOLD if bold else FONT_NAME
    return Paragraph(txt, ParagraphStyle(
        "c", fontName=fn, fontSize=size, leading=size*1.35,
        alignment=align, textColor=color, spaceAfter=0, spaceBefore=0
    ))

def make_table(headers, rows, col_widths, alt_fill=ALT_FILL):
    """Build a styled table."""
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        # Header
        ("BACKGROUND",   (0,0), (-1,0),  HDR_FILL),
        ("TEXTCOLOR",    (0,0), (-1,0),  HDR_TEXT),
        ("FONTNAME",     (0,0), (-1,0),  FONT_BOLD),
        ("FONTSIZE",     (0,0), (-1,0),  8.5),
        ("BOTTOMPADDING",(0,0), (-1,0),  6),
        ("TOPPADDING",   (0,0), (-1,0),  6),
        # Body
        ("FONTNAME",     (0,1), (-1,-1), FONT_NAME),
        ("FONTSIZE",     (0,1), (-1,-1), 8.5),
        ("TOPPADDING",   (0,1), (-1,-1), 4),
        ("BOTTOMPADDING",(0,1), (-1,-1), 4),
        ("LEFTPADDING",  (0,0), (-1,-1), 5),
        ("RIGHTPADDING", (0,0), (-1,-1), 5),
        # Grid
        ("GRID",         (0,0), (-1,-1), 0.4, colors.HexColor("#b0b8cc")),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        # Alternating row fill
        *[("BACKGROUND", (0,i), (-1,i), alt_fill)
          for i in range(2, len(data), 2)],
    ]
    t.setStyle(TableStyle(style_cmds))
    return t

# ── TABLE 1: AI Tools & Platforms ─────────────────────────────────────────────
HDR1 = [
    cell("STT",          bold=True, align=TA_CENTER),
    cell("Tên công cụ /\nThành phần",  bold=True, align=TA_CENTER),
    cell("Phiên\nbản",  bold=True, align=TA_CENTER),
    cell("Nguồn gốc /\nNhà cung cấp", bold=True, align=TA_CENTER),
    cell("Vai trò /\nMục đích sử dụng", bold=True, align=TA_CENTER),
    cell("Ghi chú",     bold=True, align=TA_CENTER),
]
CW1 = [1.0*cm, 4.2*cm, 2.0*cm, 3.8*cm, 5.8*cm, 3.2*cm]

rows1 = [
    [cell("1",align=TA_CENTER), cell("Claude 3.5 Sonnet"),
     cell("Latest",align=TA_CENTER),
     cell("Anthropic"), cell("Mô hình LLM chính cho các tác vụ suy luận phức tạp, phân tích dữ liệu, lập trình, hỗ trợ thiết kế hệ thống AI."),
     cell("API dùng chung; Miễn phí giới hạn cơ bản.")],
    [cell("2",align=TA_CENTER), cell("GitHub Copilot"),
     cell("Latest",align=TA_CENTER),
     cell("GitHub / Microsoft"),
     cell("Gợi ý code tự động trong quá trình lập trình, tăng tốc phát triển phần mềm cho toàn đội."),
     cell("Thuê bao cá nhân / tổ chức.")],
    [cell("3",align=TA_CENTER), cell("ChatGPT (GPT-4o)"),
     cell("GPT-4o",align=TA_CENTER),
     cell("OpenAI"),
     cell("Hỗ trợ brainstorming, viết tài liệu, review code, tạo test case, giải thích thuật toán."),
     cell("API có giới hạn; phù hợp tác vụ ngắn.")],
    [cell("4",align=TA_CENTER), cell("Gemini 1.5 Pro / Flash"),
     cell("1.5 Pro / Flash",align=TA_CENTER),
     cell("Google AI"),
     cell("Mở rộng context window cho xử lý tài liệu dài; tích hợp Google ecosystem."),
     cell("Miễn phí hạn chế; API trả phí.")],
    [cell("5",align=TA_CENTER), cell("Cursor AI"),
     cell("Latest",align=TA_CENTER),
     cell("Cursor"),
     cell("IDE tích hợp AI cho lập trình viên; hỗ trợ chỉnh sửa multi-file, refactor, debug thông minh."),
     cell("Đang dùng làm IDE chính.")],
    [cell("6",align=TA_CENTER), cell("DALL·E 3"),
     cell("3",align=TA_CENTER),
     cell("OpenAI"),
     cell("Sinh hình ảnh minh họa cho tài liệu, bài trình bày, mockup UI."),
     cell("Qua API OpenAI.")],
    [cell("7",align=TA_CENTER), cell("Midjourney"),
     cell("Latest",align=TA_CENTER),
     cell("Midjourney"),
     cell("Tạo hình ảnh nghệ thuật, concept art, moodboard cho dự án."),
     cell("Thuê bao Discord.")],
    [cell("8",align=TA_CENTER), cell("Leonardo AI"),
     cell("Latest",align=TA_CENTER),
     cell("Leonardo.ai"),
     cell("Sinh ảnh game-style, kiến trúc, prototype; thay thế Midjourney khi cần mở rộng."),
     cell("Miễn phí / trả phí.")],
    [cell("9",align=TA_CENTER), cell("Meta AI (Llama 3)"),
     cell("Llama 3.1 70B",align=TA_CENTER),
     cell("Meta"),
     cell("Mô hình open-weight cho fine-tuning nội bộ; thử nghiệm RAG pipeline."),
     cell("Tự host hoặc qua API.")],
    [cell("10",align=TA_CENTER), cell("Codeium"),
     cell("Latest",align=TA_CENTER),
     cell("Codeium"),
     cell("Gợi ý code miễn phí, tích hợp Vim/VSCode; phòng khi Copilot không khả dụng."),
     cell("Miễn phí, không giới hạn.")],
]

TBL1 = make_table(HDR1, rows1, CW1)

# ── TABLE 2: Datasets ─────────────────────────────────────────────────────────
HDR2 = [
    cell("STT",          bold=True, align=TA_CENTER),
    cell("Tên bộ dữ liệu", bold=True, align=TA_CENTER),
    cell("Dung lượng",   bold=True, align=TA_CENTER),
    cell("Nguồn / Nhà cung cấp", bold=True, align=TA_CENTER),
    cell("Mục đích sử dụng", bold=True, align=TA_CENTER),
    cell("Ghi chú",      bold=True, align=TA_CENTER),
]
CW2 = [1.0*cm, 3.8*cm, 2.0*cm, 3.6*cm, 5.4*cm, 3.2*cm]

rows2 = [
    [cell("1",align=TA_CENTER), cell("Common Crawl"),
     cell("~250 TB",align=TA_CENTER),
     cell("commoncrawl.org"),
     cell("Dữ liệu huấn luyện LLM; crawl web quy mô lớn."),
     cell("Open; dùng cho pretraining.")],
    [cell("2",align=TA_CENTER), cell("The Pile"),
     cell("825 GB",align=TA_CENTER),
     cell("EleutherAI"),
     cell("Dữ liệu đa dạng cho nghiên cứu LLM; gồm arXiv, GitHub, Wikipedia, v.v."),
     cell("Open; reference dataset.")],
    [cell("3",align=TA_CENTER), cell("FineWeb (Edu)"),
     cell("15T tokens",align=TA_CENTER),
     cell("HuggingFace /小天"),
     cell("Dữ liệu web chất lượng cao, đã lọc cho giáo dục; dùng huấn luyện mô hình."),
     cell("CC-BY license.")],
    [cell("4",align=TA_CENTER), cell(" Vietnamese Open Pretraining (VIPO)"),
     cell("~20 GB",align=TA_CENTER),
     cell("VinAI / CCM榜"),
     cell("Corpus tiếng Việt quy mô lớn cho pretrain model tiếng Việt."),
     cell("Miễn phí nghiên cứu.")],
    [cell("5",align=TA_CENTER), cell("OSCVN Dataset"),
     cell("~5 GB",align=TA_CENTER),
     cell("Open Vietnamese NLP"),
     cell("Dữ liệu tiếng Việt có nhãn: NER, POS, sentiment, QA."),
     cell("Open; dùng fine-tuning NLP.")],
    [cell("6",align=TA_CENTER), cell("Lao-English / Viet-Lao Parallel"),
     cell("~200 MB",align=TA_CENTER),
     cell("OPUS / self-collected"),
     cell("Dữ liệu song ngữ cho huấn luyện mô hình dịch thuật Lào–Anh–Việt."),
     cell("Cần clean và deduplicate.")],
    [cell("7",align=TA_CENTER), cell("ViHealthQA"),
     cell("~1.5 MB",align=TA_CENTER),
     cell("UIT / Open Vietnamese NLP"),
     cell("Câu hỏi–trả lời y tế tiếng Việt; dùng fine-tune chatbot y tế."),
     cell("Open; dùng thử nghiệm RAG.")],
    [cell("8",align=TA_CENTER), cell("Custom Collected (Lumohub internal)"),
     cell("Đang thu thập",align=TA_CENTER),
     cell("Lumohub"),
     cell("Dữ liệu riêng: tài liệu kỹ thuật, tài liệu pháp lý, dữ liệu người dùng ẩn danh."),
     cell("Cần tuân thủ GDPR/PDPD.")],
]

TBL2 = make_table(HDR2, rows2, CW2)

# ── TABLE 3: APIs ─────────────────────────────────────────────────────────────
HDR3 = [
    cell("STT",          bold=True, align=TA_CENTER),
    cell("Tên API / Dịch vụ", bold=True, align=TA_CENTER),
    cell("Phiên bản",    bold=True, align=TA_CENTER),
    cell("Nhà cung cấp", bold=True, align=TA_CENTER),
    cell("Mục đích sử dụng", bold=True, align=TA_CENTER),
    cell("Ghi chú",      bold=True, align=TA_CENTER),
]
CW3 = [1.0*cm, 3.6*cm, 2.2*cm, 3.4*cm, 5.6*cm, 3.2*cm]

rows3 = [
    [cell("1",align=TA_CENTER), cell("Anthropic Claude API"),
     cell("2023–06 / Latest",align=TA_CENTER),
     cell("Anthropic"),
     cell("LLM inference chính; suy luận, phân tích, lập trình, tạo nội dung."),
     cell("Có free tier; chi phí theo token.")],
    [cell("2",align=TA_CENTER), cell("OpenAI API (GPT-4o, DALL·E, TTS)"),
     cell("v1 / Latest",align=TA_CENTER),
     cell("OpenAI"),
     cell("GPT-4o cho conversation; DALL·E cho sinh ảnh; TTS cho text-to-speech."),
     cell("Có free tier; chi phí theo token.")],
    [cell("3",align=TA_CENTER), cell("Google Gemini API"),
     cell("v1beta / Latest",align=TA_CENTER),
     cell("Google AI Studio"),
     cell("LLM với context window 1M token; thử nghiệm RAG trên tài liệu dài."),
     cell("Miễn phí hạn chế; API key cần thiết.")],
    [cell("4",align=TA_CENTER), cell("Hugging Face Inference API"),
     cell("Latest",align=TA_CENTER),
     cell("HuggingFace"),
     cell("Truy cập hàng nghìn model: embedding, summarization, translation, vision."),
     cell("Miễn phí cơ bản; pro tier cho tốc độ cao.")],
    [cell("5",align=TA_CENTER), cell("Replicate API"),
     cell("Latest",align=TA_CENTER),
     cell("Replicate"),
     cell("Chạy model open-source (Llama, Stable Diffusion, FLUX) không cần server."),
     cell("Trả phí theo giây GPU.")],
    [cell("6",align=TA_CENTER), cell("GROQ API"),
     cell("Latest",align=TA_CENTER),
     cell("GROQ"),
     cell("Inference LLM tốc độ cao, low latency; phù hợp real-time chat."),
     cell("Miễn phí; rất nhanh.")],
    [cell("7",align=TA_CENTER), cell("Cloudflare Workers AI"),
     cell("Latest",align=TA_CENTER),
     cell("Cloudflare"),
     cell("Chạy AI model edge; embedding, summarization gần người dùng."),
     cell("Miễn phí tier; tính phí egress.")],
    [cell("8",align=TA_CENTER), cell("SerpAPI (Google Search)"),
     cell("Latest",align=TA_CENTER),
     cell("SerpAPI"),
     cell("Truy vấn Google Search qua API; dùng cho real-time RAG và web search."),
     cell("100 searches miễn phí/tháng.")],
    [cell("9",align=TA_CENTER), cell("Firebase / Supabase API"),
     cell("Latest",align=TA_CENTER),
     cell("Google / Supabase"),
     cell("Backend-as-a-Service: auth, database, storage, functions, realtime sync."),
     cell("Free tier đủ cho prototype.")],
    [cell("10",align=TA_CENTER), cell("SendGrid / Resend API"),
     cell("v3 / Latest",align=TA_CENTER),
     cell("Twilio SendGrid / Resend"),
     cell("Gửi email transactional và marketing; webhook nhận email reply."),
     cell("Free 100 emails/ngày.")],
]

TBL3 = make_table(HDR3, rows3, CW3)

# ── TABLE 4: Open-source Libraries & Frameworks ────────────────────────────────
HDR4 = [
    cell("STT",          bold=True, align=TA_CENTER),
    cell("Tên thư viện / Framework", bold=True, align=TA_CENTER),
    cell("Phiên bản",    bold=True, align=TA_CENTER),
    cell("Nguồn / Tác giả", bold=True, align=TA_CENTER),
    cell("Mục đích sử dụng", bold=True, align=TA_CENTER),
    cell("Ghi chú",      bold=True, align=TA_CENTER),
]
CW4 = [1.0*cm, 3.8*cm, 2.0*cm, 3.4*cm, 5.6*cm, 3.2*cm]

rows4 = [
    [cell("1",align=TA_CENTER), cell("LangChain / LangGraph"),
     cell("0.3 / 0.4",align=TA_CENTER),
     cell("LangChain Inc."),
     cell("Xây dựng pipeline LLM: RAG, agents, chains, memory; tích hợp vector DB."),
     cell("Đang dùng; có langgraph cho complex workflows.")],
    [cell("2",align=TA_CENTER), cell("LlamaIndex"),
     cell("0.10+",align=TA_CENTER),
     cell("LlamaIndex"),
     cell("RAG framework chuyên biệt; index tài liệu, query engine, data connectors."),
     cell("Phù hợp retrieval-heavy apps.")],
    [cell("3",align=TA_CENTER), cell("FAISS / ChromaDB / Qdrant"),
     cell("Latest",align=TA_CENTER),
     cell("Meta / Chroma / Qdrant"),
     cell("Vector database cho semantic search và embedding storage."),
     cell("FAISS offline; Chroma dev; Qdrant cloud/self-host.")],
    [cell("4",align=TA_CENTER), cell("sentence-transformers"),
     cell("3.x",align=TA_CENTER),
     cell("Sentence-Transformers / SBERT"),
     cell("Tạo text embedding chất lượng cao cho retrieval và similarity search."),
     cell("Dùng model 'paraphrase-multilingual-MiniLM-L12-v2'.")],
    [cell("5",align=TA_CENTER), cell("scikit-learn"),
     cell("1.5+",align=TA_CENTER),
     cell("scikit-learn developers"),
     cell("ML cổ điển: classification, clustering, regression, feature engineering."),
     cell("Dùng cho baseline model và evaluation.")],
    [cell("6",align=TA_CENTER), cell("PyTorch / Transformers"),
     cell("2.x / 4.x",align=TA_CENTER),
     cell("Meta / HuggingFace"),
     cell("Fine-tuning LLM, training custom model, inference pipeline."),
     cell("Cần GPU cho training; dùng bitsandbytes cho quantization.")],
    [cell("7",align=TA_CENTER), cell("vLLM"),
     cell("0.6+",align=TA_CENTER),
     cell("vLLM Project"),
     cell("High-throughput LLM inference; PagedAttention, continuous batching."),
     cell("Cần cho serving model tự host.")],
    [cell("8",align=TA_CENTER), cell("OpenCV"),
     cell("4.10+",align=TA_CENTER),
     cell("OpenCV team"),
     cell("Xử lý ảnh/video: detect, crop, resize, format conversion, OCR pre-processing."),
     cell("Python bindings.")],
    [cell("9",align=TA_CENTER), cell("Tesseract OCR"),
     cell("5.x",align=TA_CENTER),
     cell("Google / UB-Mannheim"),
     cell("OCR nhận dạng ký tự từ ảnh/scan tài liệu tiếng Việt và tiếng Lào."),
     cell("Cần fine-tune cho tiếng Việt/Lào.")],
    [cell("10",align=TA_CENTER), cell("ElevenLabs / Coqui TTS"),
     cell("Latest",align=TA_CENTER),
     cell("ElevenLabs / Coqui"),
     cell("Text-to-Speech đa ngôn ngữ; tạo giọng nói cho chatbot và ứng dụng."),
     cell("ElevenLabs trả phí; Coqui open-source.")],
    [cell("11",align=TA_CENTER), cell("Streamlit / Gradio"),
     cell("Latest",align=TA_CENTER),
     cell("Streamlit / Gradio"),
     cell("Build UI nhanh cho demo, internal tools, proof-of-concept."),
     cell("Dùng Streamlit cho dashboard; Gradio cho model serving.")],
    [cell("12",align=TA_CENTER), cell("FastAPI / uvicorn"),
     cell("0.115+ / 0.30+",align=TA_CENTER),
     cell("Tiang Sommer / Starlette"),
     cell("Backend API server cho microservice AI, webhook, REST endpoints."),
     cell("Async, auto-docs, Pydantic validation.")],
    [cell("13",align=TA_CENTER), cell("Pydantic / Dataclass"),
     cell("2.x",align=TA_CENTER),
     cell("Samuel Colvin"),
     cell("Data validation và serialization; định nghĩa schema cho API request/response."),
     cell("Dùng cho tất cả data models.")],
    [cell("14",align=TA_CENTER), cell("SQLAlchemy / Alembic"),
     cell("2.x",align=TA_CENTER),
     cell("SQLAlchemy team"),
     cell("ORM và database migration; tương thích PostgreSQL, SQLite."),
     cell("Dùng async SQLAlchemy với asyncio.")],
    [cell("15",align=TA_CENTER), cell("pytest / pytest-asyncio"),
     cell("8.x",align=TA_CENTER),
     cell("pytest-dev"),
     cell("Unit test và integration test cho LLM pipeline, API, database operations."),
     cell("Fixtures cho mock LLM responses.")],
]

TBL4 = make_table(HDR4, rows4, CW4)

# ── TABLE 5: In-house / Self-built Components ────────────────────────────────
HDR5 = [
    cell("STT",          bold=True, align=TA_CENTER),
    cell("Tên thành phần", bold=True, align=TA_CENTER),
    cell("Trạng thái",   bold=True, align=TA_CENTER),
    cell("Người phụ trách", bold=True, align=TA_CENTER),
    cell("Mô tả chức năng", bold=True, align=TA_CENTER),
    cell("Công nghệ",    bold=True, align=TA_CENTER),
]
CW5 = [1.0*cm, 3.6*cm, 2.0*cm, 2.8*cm, 5.4*cm, 3.2*cm]

rows5 = [
    [cell("1",align=TA_CENTER), cell("Lumohub RAG Pipeline"),
     cell("Đang phát triển",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Hệ thống Retrieval-Augmented Generation tùy chỉnh: chunking, embedding, reranking, hybrid search (BM25 + vector). Hỗ trợ tiếng Việt và tiếng Lào."),
     cell("LangChain, ChromaDB, sentence-transformers, FastAPI")],
    [cell("2",align=TA_CENTER), cell("Vietnamese / Lao Text Processor"),
     cell("Đang phát triển",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Bộ xử lý ngôn ngữ tự nhiên: tokenization, normalization, stopword, stemming cho tiếng Việt và tiếng Lào. Chuẩn hóa Unicode, xử lý font cũ."),
     cell("underthesea, pyvi, PyICU, custom rules")],
    [cell("3",align=TA_CENTER), cell("Document OCR & Extraction Pipeline"),
     cell("Proof of Concept",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Pipeline nhận dạng và trích xuất nội dung từ tài liệu scan/PDF: OCR → layout detection → table extraction → entity recognition."),
     cell("Tesseract OCR, PDFPlumber, OpenCV, LayoutLM")],
    [cell("4",align=TA_CENTER), cell("Lumohub Chatbot Framework"),
     cell("Đang phát triển",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Framework chatbot đa ngôn ngữ (VN, LO, EN): conversation management, context tracking, tool calling, multi-turn memory, guardrails."),
     cell("LangGraph, Claude API, Firebase")],
    [cell("5",align=TA_CENTER), cell("Lumohub Analytics Dashboard"),
     cell("Proof of Concept",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Dashboard giám sát: usage metrics, token consumption, latency, error rates, user feedback. Real-time update."),
     cell("Streamlit, Plotly, PostgreSQL, Redis")],
    [cell("6",align=TA_CENTER), cell("Lumohub API Gateway & Auth"),
     cell("Đang phát triển",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("API gateway tập trung: authentication (JWT + OAuth2), rate limiting, request logging, abuse detection, API versioning."),
     cell("FastAPI, Firebase Auth, Redis, PostgreSQL")],
    [cell("7",align=TA_CENTER), cell("Lumohub Data Pipeline (ETL)"),
     cell("Proof of Concept",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Pipeline xử lý dữ liệu: thu thập → clean → transform → store. Hỗ trợ incremental update, deduplication, data quality checks."),
     cell("Python, Pandas, PostgreSQL, Apache Airflow")],
    [cell("8",align=TA_CENTER), cell("Lumohub Multimodal Agent"),
     cell("Ý tưởng / Lên kế hoạch",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Agent đa phương thức: kết hợp LLM + vision + audio + tool use. Xử lý input ảnh, âm thanh, văn bản trong một conversation."),
     cell("Claude API, LangChain multimodal, Whisper")],
    [cell("9",align=TA_CENTER), cell("Lumohub Fine-tuned Models"),
     cell("Ý tưởng / Lên kế hoạch",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("Fine-tune Llama 3.1 hoặc Phi-3 cho ngữ cảnh Lào–Việt. Dataset riêng thu thập từ tài liệu pháp lý, y tế, kỹ thuật."),
     cell("PyTorch, LoRA, QLoRA, vLLM")],
    [cell("10",align=TA_CENTER), cell("Lumohub CI/CD & MLOps Pipeline"),
     cell("Đang phát triển",align=TA_CENTER),
     cell("Lumohub Dev Team"),
     cell("CI/CD cho model deployment: automated testing, model versioning (DVC/MLflow), A/B testing, canary rollout, rollback."),
     cell("GitHub Actions, Docker, DVC, MLflow")],
]

TBL5 = make_table(HDR5, rows5, CW5)

# ── Cover info ────────────────────────────────────────────────────────────────
def hr():
    t = Table([[""]], colWidths=[CONTENT_W], rowHeights=[1])
    t.setStyle(TableStyle([
        ("LINEABOVE", (0,0), (-1,0), 1.5, HDR_FILL),
        ("BOTTOMPADDING", (0,0), (-1,0), 0),
        ("TOPPADDING",    (0,0), (-1,0), 0),
    ]))
    return t

# ── Build story ───────────────────────────────────────────────────────────────
story = []

# Title
story.append(Spacer(1, 0.4*cm))
story.append(Paragraph("BẢN KÊ KHAI CÔNG CỤ AI, BỘ DỮ LIỆU, API, THƯ VIỆN", s_title))
story.append(Paragraph("MÃ NGUỒN MỞ VÀ PHẦN VIỆC DO ĐỘI TỰ XÂY DỰNG", s_sub))
story.append(Paragraph("Dự án LUMOHUB — Công nghệ LUMO", s_sub))
story.append(hr())
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph(
    "Tài liệu này ghi nhận đầy đủ và chi tiết các công cụ AI, bộ dữ liệu, API, thư viện mã nguồn mở, "
    "cũng như các thành phần tự phát triển được sử dụng trong quá trình xây dựng và vận hành hệ thống LUMOHUB. "
    "Thông tin được cập nhật định kỳ và phản ánh đúng thực trạng triển khai tại thời điểm lập tài liệu.",
    s_body))
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<b>Đơn vị:</b> Công ty Luminos Technology &bull; <b>Ngày lập:</b> Tháng 9/2026 &bull; <b>Phiên bản:</b> 1.0",
    s_note))
story.append(Spacer(1, 0.3*cm))

# ── Section 1 ────────────────────────────────────────────────────────────────
story.append(Paragraph("PHẦN I. CÔNG CỤ VÀ NỀN TẢNG AI", s_section))
story.append(Paragraph(
    "Danh sách các công cụ AI, nền tảng hỗ trợ lập trình, sinh nội dung (văn bản/hình ảnh) "
    "được đội ngũ sử dụng trong các giai đoạn phát triển và vận hành dự án.",
    s_body))
story.append(Spacer(1, 0.1*cm))
story.append(TBL1)
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<i>Ghi chú: Các công cụ được đánh giá định kỳ về hiệu quả và chi phí. "
    "Claude 3.5 Sonnet và Cursor AI là hai công cụ được sử dụng thường xuyên nhất.</i>",
    s_note))

story.append(PageBreak())

# ── Section 2 ────────────────────────────────────────────────────────────────
story.append(Paragraph("PHẦN II. BỘ DỮ LIỆU", s_section))
story.append(Paragraph(
    "Các bộ dữ liệu được sử dụng cho huấn luyện (pretraining, fine-tuning), nghiên cứu "
    "và xây dựng ứng dụng AI nội bộ. Nguồn gốc, dung lượng và phạm vi sử dụng được ghi nhận rõ ràng.",
    s_body))
story.append(Spacer(1, 0.1*cm))
story.append(TBL2)
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<i>Ghi chú: Việc sử dụng dữ liệu tuân thủ các quy định pháp luật về bảo vệ dữ liệu cá nhân "
    "(GDPR, PDPD). Dữ liệu nội bộ của Lumohub được ẩn danh hóa trước khi dùng trong ML pipeline.</i>",
    s_note))

story.append(Spacer(1, 0.3*cm))

# ── Section 3 ────────────────────────────────────────────────────────────────
story.append(Paragraph("PHẦN III. API VÀ DỊCH VỤ BÊN THỨ BA", s_section))
story.append(Paragraph(
    "Các API và dịch vụ cloud bên thứ ba được tích hợp vào hệ thống LUMOHUB. "
    "Chi phí, giới hạn sử dụng và phương án dự phòng được ghi nhận để đảm bảo tính sẵn sàng.",
    s_body))
story.append(Spacer(1, 0.1*cm))
story.append(TBL3)
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<i>Ghi chú: Nên triển khai circuit breaker và fallback khi dùng API bên thứ ba. "
    "GROQ và Cloudflare Workers AI là hai lựa chọn miễn phí tốc độ cao đang được đánh giá.</i>",
    s_note))

story.append(PageBreak())

# ── Section 4 ────────────────────────────────────────────────────────────────
story.append(Paragraph("PHẦN IV. THƯ VIỆN VÀ FRAMEWORK MÃ NGUỒN MỞ", s_section))
story.append(Paragraph(
    "Các thư viện và framework mã nguồn mở đóng vai trò nền tảng trong kiến trúc hệ thống LUMOHUB, "
    "từ LLM orchestration đến xử lý dữ liệu và triển khai model.",
    s_body))
story.append(Spacer(1, 0.1*cm))
story.append(TBL4)
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<i>Ghi chú: Phiên bản thư viện được lock trong requirements.txt / pyproject.toml. "
    "LangChain và sentence-transformers là hai thư viện quan trọng nhất của tech stack.</i>",
    s_note))

story.append(Spacer(1, 0.3*cm))

# ── Section 5 ────────────────────────────────────────────────────────────────
story.append(Paragraph("PHẦN V. THÀNH PHẦN TỰ XÂY DỰNG", s_section))
story.append(Paragraph(
    "Các thành phần phần mềm do đội ngũ Lumohub tự phát triển, bao gồm cả sản phẩm hoàn thiện "
    "và các module đang trong giai đoạn thử nghiệm. Đây là tài sản trí tuệ cốt lõi của công ty.",
    s_body))
story.append(Spacer(1, 0.1*cm))
story.append(TBL5)
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "<i>Ghi chú: Trạng thái: (1) Hoàn thành – đã triển khai production, "
    "(2) Đang phát triển – trong giai đoạn active development, "
    "(3) Proof of Concept – đang thử nghiệm tính khả thi, "
    "(4) Ý tưởng/Lên kế hoạch – chưa bắt đầu triển khai. "
    "Mã nguồn các thành phần hoàn thành được quản lý trên GitHub private repository.</i>",
    s_note))

story.append(Spacer(1, 0.5*cm))
story.append(hr())
story.append(Spacer(1, 0.15*cm))
story.append(Paragraph(
    "Tài liệu do Công ty Luminos Technology biên soạn. Mọi sao chép hoặc trích dẫn vui lòng ghi nguồn.<br/>"
    "Cập nhật lần cuối: Tháng 9/2026 &bull; Phiên bản 1.0 &bull; Liên hệ: Lumohub Team",
    s_footer))

# ── Build PDF ─────────────────────────────────────────────────────────────────
doc.build(story)
print(f"\n[OK] PDF created: {OUT_PDF}")
print(f"  Size: {os.path.getsize(OUT_PDF):,} bytes")
