from google import genai
from google.genai import types as gtypes
import wave
import logging
import os

logging.basicConfig(level=logging.INFO)
lumo_logger = logging.getLogger("lumo_tts")

tts_client = genai.Client(api_key="AIzaSyDj14rOtzeh38ZqDi8Ymifn9g9aocczYns")


def _pcm_to_wav(pcm_data: bytes, output_path: str, sample_rate: int = 24000):
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)   # 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)


def generate_tts(v2_answer: str, output_file: str = "lumo_tts_output.wav"):
    lumo_logger.info("[AUDIO] TTS start")

    tts_resp = tts_client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=v2_answer,
        config=gtypes.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=gtypes.SpeechConfig(
                voice_config=gtypes.VoiceConfig(
                    prebuilt_voice_config=gtypes.PrebuiltVoiceConfig(
                        voice_name="Kore"
                    )
                )
            ),
        ),
    )

    # debug cấu trúc response
    lumo_logger.info(f"[AUDIO] raw response: {tts_resp}")

    if not getattr(tts_resp, "candidates", None):
        raise RuntimeError("TTS response không có candidates")

    candidate = tts_resp.candidates[0]
    if not getattr(candidate, "content", None):
        finish_reason = getattr(candidate, "finish_reason", None)
        safety = getattr(candidate, "safety_ratings", None)
        raise RuntimeError(
            f"Candidate không có content. finish_reason={finish_reason}, safety={safety}, candidate={candidate}"
        )

    if not getattr(candidate.content, "parts", None):
        raise RuntimeError(f"Candidate có content nhưng không có parts: {candidate.content}")

    audio_part = None
    for part in candidate.content.parts:
        inline_data = getattr(part, "inline_data", None)
        if inline_data and getattr(inline_data, "data", None):
            audio_part = inline_data
            break

    if audio_part is None:
        raise RuntimeError(f"Không tìm thấy inline audio data trong parts: {candidate.content.parts}")

    pcm_data = audio_part.data
    mime_type = audio_part.mime_type or ""

    lumo_logger.info(f"[AUDIO] TTS done: {len(pcm_data)} bytes, mime={mime_type}")

    # Theo docs TTS mẫu chính thức, output được lưu như PCM rồi bọc thành wav 24kHz
    _pcm_to_wav(pcm_data, output_file, sample_rate=24000)

    lumo_logger.info(f"[AUDIO] Saved file: {output_file}")
    return output_file


if __name__ == "__main__":
    text = "Xin chào, tôi là lumo. Ngày hôm nay của bạn như thế nào"
    generate_tts(text)