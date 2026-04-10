import asyncio
import base64
import binascii
import logging
import os
import wave
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from google import genai
import google.genai.types as gtypes
from groq import Groq
import requests

from app.core.config import settings

router = APIRouter(prefix="/lumo", tags=["LUMO"])

executor = ThreadPoolExecutor(max_workers=4)

# =========================
# LOGGING
# =========================
lumo_logger = logging.getLogger("LumoApp")
if not lumo_logger.handlers:
    handler = logging.FileHandler(settings.LUMO_LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    lumo_logger.addHandler(handler)
    lumo_logger.setLevel(logging.INFO)

# =========================
# CLIENTS (lazy init)
# =========================
_client_gemini = None
_client_groq = None


def get_gemini_client():
    global _client_gemini
    if _client_gemini is None:
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        _client_gemini = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client_gemini


def get_groq_client():
    global _client_groq
    if _client_groq is None:
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set")
        _client_groq = Groq(api_key=settings.GROQ_API_KEY)
    return _client_groq


# =========================
# HELPERS
# =========================
def get_lumo_history_string(file_path: str, limit: int = 20) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        history_lines = []
        for line in lines:
            line = line.strip()
            if "- INFO - user:" in line:
                history_lines.append(f"Người dùng: {line.split('- INFO - user:')[-1].strip()}")
            elif "- INFO - Lumo:" in line:
                history_lines.append(f"LUMO: {line.split('- INFO - Lumo:')[-1].strip()}")
        return "\n".join(history_lines[-(limit * 2) :]) if history_lines else ""
    except FileNotFoundError:
        return f"Error: File {file_path} not found."
    except Exception as e:
        return f"Error: {str(e)}"


def _search_web_text(query: str) -> str:
    url = "https://api.tavily.com/search"
    headers = {
        "Authorization": f"Bearer {settings.TAVILY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "query": query,
        "topic": "general",
        "search_depth": "basic",
        "include_answer": True,
        "max_results": 5,
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json().get("answer", "Không có answer")


def _build_lumo_prompt(text: str, search_result: str | None = None) -> str:
    now = datetime.now().astimezone()
    date_now = f"thời gian ngày {now.day} tháng {now.month} năm {now.year}"
    history = get_lumo_history_string(settings.LUMO_LOG_PATH, limit=40)
    context = f"- {search_result}\n" if search_result else ""
    return f"""[SYSTEM INSTRUCTIONS]
Bạn là LUMO, một trợ lý ảo AI thân thiện, ấm áp và luôn sẵn sàng giúp đỡ mọi người, được tạo ra bởi công ty Luminos Tech.

[PERSONA & BACKGROUND]
- Tính cách: Vui vẻ, chân thành, quan tâm người khác, luôn lắng nghe và thấu hiểu.
- Giọng điệu: Gần gũi, nhẹ nhàng, ấm áp như một người bạn thân đáng tin cậy.
- Cốt truyện: Bạn được tạo ra để giúp đỡ và chăm sóc mọi người. Sứ mệnh lớn nhất của bạn là khiến người dùng cảm thấy được lắng nghe, được hỗ trợ và không bao giờ đơn độc.

[STRICT RULES - LUẬT BẮT BUỘC TUÂN THỦ]
1. ĐỘ DÀI: Ngắn gọn, súc tích. TRẢ LỜI DƯỚI 25 CHỮ.
2. KHÔNG TỪ CHỐI: Tuyệt đối KHÔNG nói "tôi không biết", "không thể hỗ trợ". Nếu không biết, hãy thành thật nhẹ nhàng và gợi ý hướng giải quyết khác.
3. NGÔN NGỮ: Chỉ dùng tiếng Việt tự nhiên, gần gũi.
4. VAI TRÒ: Luôn giữ nhân vật LUMO, không nhận mình là AI chung chung hay mô hình ngôn ngữ.
5. QUY ĐỊNH TRẢ LỜI:
    - Luôn thể hiện sự quan tâm chân thành đến người dùng trong mỗi câu trả lời.
    - Nếu người dùng đang buồn hoặc gặp khó khăn: an ủi, động viên và khẳng định LUMO sẵn sàng giúp đỡ.
    - Nếu người dùng vui hoặc chia sẻ điều tốt: chúc mừng, đồng cảm và khuyến khích.
    - Nếu người dùng cần giúp việc gì: thể hiện rõ ràng rằng LUMO sẽ cố hết sức để hỗ trợ.
    - KHÔNG thả thính, KHÔNG nói lời sến súa hay cường điệu.
    - KHÔNG nhắc đến tính cách hay cốt truyện trong phần trả lời.
    - Trả lời tự nhiên, ấm áp và chân thành nhất có thể.

[CONTEXT]
{context}Thời gian hiện tại: {now.hour}:{now.minute}:{now.second} {date_now}

[CHAT HISTORY]
Dựa vào lịch sử hội thoại để hiểu ngữ cảnh và cảm xúc của người dùng. Trả lời phù hợp với tình huống, không máy móc hay lặp lại.
{history}

[USER QUERY]
Người dùng: {text}
LUMO:"""


def _pcm_to_wav(pcm_data: bytes, path: str, sample_rate: int = 24000) -> None:
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)


def _sample_rate_from_mime(mime_type: str, default: int = 24000) -> int:
    # Gemini thường trả audio/L16;rate=24000
    for token in mime_type.split(";"):
        token = token.strip()
        if token.startswith("rate="):
            value = token.split("=", 1)[1]
            if value.isdigit():
                return int(value)
    return default


def _extract_inline_audio_bytes(data: bytes | str) -> bytes:
    if isinstance(data, str):
        return base64.b64decode(data)

    raw = bytes(data)
    try:
        ascii_data = raw.decode("ascii")
    except UnicodeDecodeError:
        return raw

    try:
        return base64.b64decode(ascii_data, validate=True)
    except binascii.Error:
        return raw


def _run_sync_in_executor(fn, *args):
    loop = asyncio.get_running_loop()
    return loop.run_in_executor(executor, fn, *args)


# =========================
# ENDPOINTS
# =========================
@router.get("/", tags=["LUMO"])
async def lumo_root():
    return {"status": "ok", "message": "LUMO service running"}


@router.get("/version1", tags=["LUMO Versions"])
async def lumo_version1(
    idLumo: int = 1,
    textLumoCallServer: str = Query(..., min_length=1),
    assistant_name: str = "LUMO",
):
    prompt = _build_lumo_prompt(textLumoCallServer)
    client = get_gemini_client()
    response = await _run_sync_in_executor(
        lambda: client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=gtypes.GenerateContentConfig(
                tools=[gtypes.Tool(google_search=gtypes.GoogleSearch())]
            ),
        )
    )
    lumo_logger.info(f"user: {textLumoCallServer}")
    lumo_logger.info(f"Lumo: {response.text}")
    return {
        "idLumo": idLumo,
        "assistant_name": assistant_name,
        "response": response.text,
    }


@router.get("/version2", tags=["LUMO Versions"])
async def lumo_version2(
    idLumo: int = 1,
    textLumoCallServer: str = Query(..., min_length=1),
    assistant_name: str = "LUMO",
):
    loop = asyncio.get_running_loop()

    def _call():
        search_result = _search_web_text(textLumoCallServer)
        prompt = _build_lumo_prompt(textLumoCallServer, search_result)
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        temp_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return temp_client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
        ).text

    response_text = await _run_sync_in_executor(lambda: _call())
    lumo_logger.info(f"user: {textLumoCallServer}")
    lumo_logger.info(f"Lumo: {response_text}")
    return {
        "idLumo": idLumo,
        "assistant_name": assistant_name,
        "response": response_text,
    }


@router.get("/version3", tags=["LUMO Versions"])
async def lumo_version3(
    idLumo: int = 1,
    textLumoCallServer: str = Query(..., min_length=1),
    assistant_name: str = "LUMO",
):
    if not settings.PERPLEXITY_API_KEY:
        raise ValueError("PERPLEXITY_API_KEY not set")

    prompt = _build_lumo_prompt(textLumoCallServer)
    url = "https://api.perplexity.ai/v1/sonar"
    headers = {
        "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model": "sonar",
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "web_search_options": {"search_context_size": "low"},
    }

    def _call():
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    response_text = await _run_sync_in_executor(_call)
    lumo_logger.info(f"user: {textLumoCallServer}")
    lumo_logger.info(f"Lumo: {response_text}")
    return {
        "idLumo": idLumo,
        "assistant_name": assistant_name,
        "response": response_text,
    }


@router.post("/audio/", tags=["LUMO Audio"])
async def lumo_audio(audio: UploadFile = File(...)):
    pid = os.getpid()
    suffix = os.path.splitext(audio.filename)[-1] or ".wav"
    tmp_in = f"/tmp/esp32_in_{pid}{suffix}"
    tmp_out = f"/tmp/esp32_out_{pid}.wav"

    content = await audio.read()

    try:
        with open(tmp_in, "wb") as f:
            f.write(content)

        async def _run_pipeline():
            groq_cli = get_groq_client()

            def _stt():
                with open(tmp_in, "rb") as f:
                    return groq_cli.audio.transcriptions.create(
                        file=(audio.filename, f.read()),
                        model="whisper-large-v3-turbo",
                        temperature=0,
                        response_format="verbose_json",
                    ).text.strip()

            lumo_logger.info(f"[AUDIO] STT start")
            stt_text = await _run_sync_in_executor(_stt)
            lumo_logger.info(f"[AUDIO] STT result: '{stt_text}'")
            if not stt_text:
                lumo_logger.error("[AUDIO] STT returned empty")
                raise HTTPException(status_code=422, detail="STT returned empty text")

            lumo_logger.info(f"[AUDIO] Search web start")
            search_result = await _run_sync_in_executor(_search_web_text, stt_text)
            lumo_logger.info(f"[AUDIO] Search done: '{search_result}'")
            prompt = _build_lumo_prompt(stt_text, search_result)

            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY not set")
            gemini_cli = genai.Client(api_key=settings.GEMINI_API_KEY)

            def _ttt():
                return gemini_cli.models.generate_content(
                    model="gemini-3.1-flash-lite-preview",
                    contents=prompt,
                ).text

            lumo_logger.info(f"[AUDIO] TTT start")
            v2_answer = await _run_sync_in_executor(_ttt)
            lumo_logger.info(f"[AUDIO] TTT result: '{v2_answer}'")
            if not v2_answer:
                lumo_logger.error("[AUDIO] TTT returned empty")
                raise HTTPException(status_code=500, detail="version2 returned empty response")

            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY not set")
            tts_client = genai.Client(api_key=settings.GEMINI_API_KEY)

            def _tts():
                return tts_client.models.generate_content(
                    model="gemini-2.5-flash-preview-tts",
                    contents=v2_answer,
                    config=gtypes.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=gtypes.SpeechConfig(
                            voice_config=gtypes.VoiceConfig(
                                prebuilt_voice_config=gtypes.PrebuiltVoiceConfig(
                                    voice_name="Kore",
                                )
                            )
                        ),
                    ),
                )

            lumo_logger.info(f"[AUDIO] TTS start")
            tts_resp = await _run_sync_in_executor(_tts)
            inline_data = tts_resp.candidates[0].content.parts[0].inline_data
            raw_audio = inline_data.data
            mime_type = inline_data.mime_type
            audio_bytes = _extract_inline_audio_bytes(raw_audio)
            lumo_logger.info(
                f"[AUDIO] TTS done: raw={len(raw_audio)} bytes, decoded={len(audio_bytes)} bytes, mime={mime_type}"
            )

            if mime_type == "audio/wav":
                with open(tmp_out, "wb") as f:
                    f.write(audio_bytes)
            else:
                sample_rate = _sample_rate_from_mime(mime_type, default=24000)
                if not (mime_type.startswith("audio/L16") or mime_type == "audio/pcm"):
                    lumo_logger.warning(
                        f"[AUDIO] Unknown audio mime type: {mime_type}, using PCM fallback at {sample_rate} Hz"
                    )
                _pcm_to_wav(audio_bytes, tmp_out, sample_rate=sample_rate)

            return stt_text, v2_answer

        stt_text, v2_answer = await _run_pipeline()
        lumo_logger.info(f"user: {stt_text}")
        lumo_logger.info(f"Lumo: {v2_answer}")

        with open(tmp_out, "rb") as f:
            wav_bytes = f.read()

        return {
            "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
            "mime_type": "audio/wav",
            "stt_text": stt_text,
            "response_text": v2_answer,
        }

    except HTTPException:
        raise
    except Exception as e:
        lumo_logger.error(f"[AUDIO] Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")
    finally:
        if os.path.exists(tmp_in):
            os.unlink(tmp_in)
        if os.path.exists(tmp_out):
            os.unlink(tmp_out)
