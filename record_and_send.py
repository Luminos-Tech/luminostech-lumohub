"""record_and_send.py
======================

Thu âm 5 giây từ microphone, gửi lên backend LUMO Hub (`/api/v1/lumo/audio/`),
nhận WAV phản hồi, lưu ra file và phát lại để kiểm tra âm thanh đúng hay không.

Mục đích: smoke-test end-to-end của luồng STT -> LLM -> TTS trên máy dev,
không cần ESP32.

Usage (PowerShell):
    python record_and_send.py --email admin@luminostech.tech --password "Admin@123"

    # dùng token có sẵn (bỏ qua login):
    python record_and_send.py --token eyJhbGciOi...

    # nghe lại file local để so sánh với response:
    python record_and_send.py --play-local

Env:
    BACKEND_URL  mặc định http://127.0.0.1:8000
    DURATION     mặc định 5 (giây)

Dependencies (cài thêm nếu thiếu):
    pip install sounddevice soundfile numpy requests
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import requests
import sounddevice as sd
import soundfile as sf


SAMPLE_RATE = 16000        # Hz — trùng với firmware ESP32 đang dùng
CHANNELS = 1
DTYPE = "int16"
DEFAULT_DURATION = 5.0
DEFAULT_BACKEND = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
LOCAL_RECORD_PATH = Path("local_record.wav")
RESPONSE_PATH = Path("response.wav")


def login(email: str, password: str, backend: str) -> str:
    """Đăng nhập JSON, trả về access_token."""
    url = f"{backend}/api/v1/auth/login"
    print(f"[LOGIN] POST {url}")
    r = requests.post(
        url,
        json={"email": email, "password": password},
        timeout=15,
    )
    print(f"[LOGIN] HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text[:500])
        raise SystemExit("Login failed")
    token = r.json().get("access_token")
    if not token:
        raise SystemExit(f"No access_token in response: {r.text[:200]}")
    return token


def record_audio(duration: float) -> np.ndarray:
    """Thu âm từ mic mặc định."""
    print(f"[MIC] recording {duration:.1f}s @ {SAMPLE_RATE} Hz mono int16...")
    frames = int(duration * SAMPLE_RATE)
    audio = sd.rec(
        frames,
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype=DTYPE,
        blocking=True,
    )
    # sounddevice trả về shape (frames, channels) cho int16
    audio = audio.flatten()
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    rms = float(np.sqrt(np.mean(audio.astype(np.float32) ** 2))) if audio.size else 0.0
    print(f"[MIC] captured {len(audio)} samples, peak={peak}, rms={rms:.1f}")
    if peak == 0:
        print("[MIC][WARN] silent recording — mic không nhận tín hiệu?", file=sys.stderr)
    return audio


def save_wav(path: Path, audio: np.ndarray) -> None:
    sf.write(str(path), audio, SAMPLE_RATE, subtype="PCM_16")
    size = path.stat().st_size
    print(f"[SAVE] {path}  ({size} bytes)")


def send_audio(token: str, backend: str, wav_path: Path) -> dict:
    """Upload lên /api/v1/lumo/audio/, trả về JSON đã decode."""
    url = f"{backend}/api/v1/lumo/audio/"
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[UPLOAD] POST {url}  ({wav_path.stat().st_size} bytes)")
    t0 = time.time()
    with open(wav_path, "rb") as f:
        r = requests.post(
            url,
            headers=headers,
            files={"audio": (wav_path.name, f, "audio/wav")},
            timeout=120,
        )
    elapsed = time.time() - t0
    print(f"[UPLOAD] HTTP {r.status_code}  ({elapsed:.1f}s)")

    # Backend có 2 dạng trả về:
    #   - thành công: JSON {audio_base64, mime_type, stt_text, response_text}
    #   - lỗi: JSON {"detail": "..."}
    if r.status_code != 200:
        print("[UPLOAD][ERROR] response body (first 500 chars):")
        print(r.text[:500])
        raise SystemExit(f"Upload failed with HTTP {r.status_code}")

    try:
        payload = r.json()
    except json.JSONDecodeError:
        print("[UPLOAD][ERROR] non-JSON response:", r.text[:500])
        raise

    if "audio_base64" not in payload:
        print("[UPLOAD][ERROR] missing audio_base64:", payload)
        raise SystemExit("Bad response shape")

    import base64
    wav_bytes = base64.b64decode(payload["audio_base64"])
    RESPONSE_PATH.write_bytes(wav_bytes)
    print(f"[SAVE] {RESPONSE_PATH}  ({len(wav_bytes)} bytes)")
    print(f"[STT] user said : {payload.get('stt_text', '')!r}")
    print(f"[LLM] lumo reply: {payload.get('response_text', '')!r}")
    print(f"[TTS] mime={payload.get('mime_type', 'audio/wav')}  bytes={len(wav_bytes)}")
    return payload


def play_wav(path: Path) -> None:
    """Phát file WAV ra default output device (blocking)."""
    print(f"[PLAY] {path}  ({path.stat().st_size} bytes)")
    try:
        data, sr = sf.read(str(path), dtype="float32")
    except Exception as e:
        print(f"[PLAY][ERROR] cannot read {path}: {e}", file=sys.stderr)
        return

    # verify WAV header cơ bản
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        sr_wav = wf.getframerate()
        sampwidth = wf.getsampwidth()
        nframes = wf.getnframes()
    print(
        f"[PLAY] wav header: channels={channels}  rate={sr_wav}  "
        f"sampwidth={sampwidth}  frames={nframes}"
    )

    sd.play(data, sr)
    sd.wait()
    print("[PLAY] done")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=False)
    g.add_argument("--token", help="Access token (bỏ qua login)")
    p.add_argument("--email", help="Email để login")
    p.add_argument("--password", help="Password để login")
    p.add_argument("--duration", type=float, default=DEFAULT_DURATION, help="Thời gian thu (giây)")
    p.add_argument("--backend", default=DEFAULT_BACKEND, help="Backend base URL")
    p.add_argument("--out", default=str(RESPONSE_PATH), help="File output WAV từ server")
    p.add_argument("--local-out", default=str(LOCAL_RECORD_PATH), help="File WAV local")
    p.add_argument("--play-local", action="store_true", help="Phát lại file local trước khi gửi")
    p.add_argument("--no-play", action="store_true", help="Không phát response sau khi nhận")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    # allow global RESPONSE_PATH override
    global RESPONSE_PATH
    RESPONSE_PATH = Path(args.out)
    local_path = Path(args.local_out)

    # 1. Auth
    if args.token:
        token = args.token
        print("[AUTH] using provided token")
    else:
        if not (args.email and args.password):
            print("Cần --email + --password  hoặc  --token", file=sys.stderr)
            sys.exit(2)
        token = login(args.email, args.password, args.backend)

    # 2. Quick health check (không bắt buộc)
    try:
        h = requests.get(f"{args.backend}/health", timeout=5)
        print(f"[HEALTH] /health -> {h.status_code}: {h.text.strip()[:200]}")
    except Exception as e:
        print(f"[HEALTH][WARN] cannot reach {args.backend}/health: {e}", file=sys.stderr)

    # 3. Record
    audio = record_audio(args.duration)
    save_wav(local_path, audio)

    if args.play_local:
        play_wav(local_path)

    # 4. Upload
    payload = send_audio(token, args.backend, local_path)

    # 5. Play response
    if not args.no_play:
        play_wav(RESPONSE_PATH)
    else:
        print(f"[DONE] response saved at {RESPONSE_PATH}  (không phát)")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[ABORT] Ctrl+C")
        sys.exit(130)
