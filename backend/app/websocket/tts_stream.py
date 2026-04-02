import asyncio
import io
import json
import logging
import wave
import struct
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
import google.genai.types as gtypes
import requests
from groq import Groq

from app.core.config import settings
from app.crud.device import get_device_by_code, normalize_device_code

router = APIRouter(prefix="/ws", tags=["WebSocket"])

executor = ThreadPoolExecutor(max_workers=4)

lumo_logger = logging.getLogger("LumoApp")
if not lumo_logger.handlers:
    handler = logging.FileHandler(settings.LUMO_LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    lumo_logger.addHandler(handler)
    lumo_logger.setLevel(logging.INFO)

_gemini_client = None
_groq_client = None


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini_client


def _get_groq():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    return _groq_client


# ─── LUMO PROMPT BUILDER ────────────────────────────────────────────────────

def _get_lumo_history_string(file_path: str, limit: int = 20) -> str:
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
        return "\n".join(history_lines[-(limit * 2):]) if history_lines else ""
    except FileNotFoundError:
        return ""
    except Exception:
        return ""


def _search_web_text(query: str) -> str:
    url = "https://api.tavily.com/search"
    headers = {"Authorization": f"Bearer {settings.TAVILY_API_KEY}", "Content-Type": "application/json"}
    payload = {"query": query, "topic": "general", "search_depth": "basic", "include_answer": True, "max_results": 5}
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json().get("answer", "")
    except Exception:
        return ""


def _build_lumo_prompt(text: str, search_result: str | None = None) -> str:
    now = datetime.now().astimezone()
    date_now = f"thời gian ngày {now.day} tháng {now.month} năm {now.year}"
    history = _get_lumo_history_string(settings.LUMO_LOG_PATH, limit=40)
    context = f"- {search_result}\n" if search_result else ""
    return f"""[SYSTEM INSTRUCTIONS]
Bạn là LUMO, một trợ lý ảo AI thân thiện, ấm áp và luôn sẵn sàng giúp đỡ mọi người, được tạo ra bởi công ty Luminos Tech.

[PERSONA & BACKGROUND]
- Tính cách: Vui vẻ, chân thành, quan tâm người khác, luôn lắng nghe và thấu hiểu.
- Giọng điệu: Gần gũi, nhẹ nhàng, ấm áp như một người bạn thân đáng tin cậy.
- Cốt truyện: Bạn được tạo ra để giúp đỡ và chăm sóc mọi người. Sứ mệnh lớn nhất của bạn là khiến người dùng cảm thấy được lắng nghe, được hỗ trợ và không bao giờ đơn độc.

[STRICT RULES - LUẬT BẮT BUỘC]
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


# ─── WAV HEADER PARSING (for Gemini audio chunks) ─────────────────────────

def _parse_wav_header(data: bytes):
    if len(data) < 44:
        return None
    try:
        with wave.open(io.BytesIO(data)) as w:
            return {
                "channels": w.getnchannels(),
                "sampwidth": w.getsampwidth(),
                "framerate": w.getframerate(),
                "nframes": w.getnframes(),
            }
    except Exception:
        return None


# ─── STT (Groq Whisper) ────────────────────────────────────────────────────

async def _run_stt(audio_path: str) -> str:
    loop = asyncio.get_running_loop()

    def _call():
        client = _get_groq()
        with open(audio_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=f,
                model="whisper-large-v3-turbo",
                temperature=0,
                response_format="verbose_json",
            )
        return result.text.strip()

    return await loop.run_in_executor(executor, _call)


# ─── LLM (Gemini) ─────────────────────────────────────────────────────────

async def _run_llm(text: str) -> str:
    loop = asyncio.get_running_loop()

    def _call():
        search_result = _search_web_text(text)
        prompt = _build_lumo_prompt(text, search_result)
        client = _get_gemini()
        resp = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
        )
        return resp.text

    return await loop.run_in_executor(executor, _call)


# ─── STREAMING TTS (Gemini → binary chunks → WebSocket) ───────────────────

async def _stream_tts(text: str, websocket: WebSocket, device_code: str):
    loop = asyncio.get_running_loop()

    def _stream():
        client = _get_gemini()
        response = client.models.generate_content_stream(
            model="gemini-2.5-flash-preview-tts",
            contents=text,
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
        for chunk in response:
            candidates = getattr(chunk, "candidates", None)
            if not candidates:
                continue
            content = getattr(candidates[0], "content", None)
            if not content:
                continue
            parts = getattr(content, "parts", None)
            if not parts:
                continue
            inline_data = getattr(parts[0], "inline_data", None)
            if not inline_data:
                continue
            audio_bytes = getattr(inline_data, "data", None)
            if audio_bytes:
                yield bytes(audio_bytes)

    try:
        all_pcm = b""
        chunk_count = 0

        async for pcm_chunk in _stream():
            if pcm_chunk:
                all_pcm += pcm_chunk
                chunk_count += 1
                # Gửi binary chunk ngay cho ESP32
                await websocket.send_bytes(pcm_chunk)

        lumo_logger.info(f"LUMO TTS stream: {device_code} | text_len={len(text)} | chunks={chunk_count} | total_bytes={len(all_pcm)}")

        if chunk_count == 0:
            await websocket.send_text(json.dumps({"type": "error", "message": "No audio generated"}))
    except Exception as e:
        lumo_logger.error(f"TTS stream error: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


# ─── WEB SOCKET ROUTE ──────────────────────────────────────────────────────

@router.websocket("/stream/{device_code}")
async def ws_tts_stream(websocket: WebSocket, device_code: str):
    """
    WebSocket endpoint cho LUMO TTS streaming.
    
    ESP32 kết nối và gửi JSON:
      { "action": "tts", "text": "xin chào" }
      HOẶC
      { "action": "stt_tts", "audio_b64": "<base64 wav>" }
    
    Server phản hồi:
      - Binary frames: raw PCM (24kHz mono 16-bit) ← phát ngay
      - JSON: { "type": "done" } | { "type": "error", "message": "..." }
    """
    await websocket.accept()
    device_code = normalize_device_code(device_code)
    print(f"[WS] Device '{device_code}' connected")

    try:
        while True:
            raw = await websocket.receive_bytes()
            
            # Thử parse JSON (UTF-8)
            try:
                text = raw.decode("utf-8")
                msg = json.loads(text)
                action = msg.get("action", "")
            except (UnicodeDecodeError, json.JSONDecodeError):
                action = ""
                msg = {}

            if action == "tts":
                # Nhận text → stream TTS ngay
                text_input = msg.get("text", "")
                if not text_input:
                    await websocket.send_text(json.dumps({"type": "error", "message": "text is empty"}))
                    continue

                lumo_logger.info(f"user: {text_input}")
                answer = await _run_llm(text_input)
                lumo_logger.info(f"Lumo: {answer}")

                await _stream_tts(answer, websocket, device_code)
                await websocket.send_text(json.dumps({"type": "done"}))

            elif action == "stt_tts":
                # Nhận base64 WAV → STT → LLM → TTS stream
                import base64
                audio_b64 = msg.get("audio_b64", "")
                tmp_in = f"/tmp/ws_stt_{device_code}.wav"
                tmp_out = f"/tmp/ws_tts_{device_code}.wav"

                try:
                    audio_bytes = base64.b64decode(audio_b64)
                    with open(tmp_in, "wb") as f:
                        f.write(audio_bytes)

                    stt_text = await _run_stt(tmp_in)
                    if not stt_text:
                        await websocket.send_text(json.dumps({"type": "error", "message": "STT returned empty"}))
                        continue

                    lumo_logger.info(f"user: {stt_text}")
                    answer = await _run_llm(stt_text)
                    lumo_logger.info(f"Lumo: {answer}")

                    # Stream TTS về ESP32
                    await _stream_tts(answer, websocket, device_code)
                    await websocket.send_text(json.dumps({"type": "done", "stt": stt_text}))

                except Exception as e:
                    lumo_logger.error(f"stt_tts pipeline error: {e}")
                    await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
                finally:
                    import os
                    for p in [tmp_in, tmp_out]:
                        if os.path.exists(p):
                            os.unlink(p)

            else:
                await websocket.send_text(json.dumps({"type": "error", "message": f"Unknown action: {action}"}))

    except WebSocketDisconnect:
        print(f"[WS] Device '{device_code}' disconnected")
    except Exception as e:
        print(f"[WS] Error with '{device_code}': {e}")
        try:
            await websocket.close()
        except Exception:
            pass
