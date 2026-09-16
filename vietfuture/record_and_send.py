"""record_and_send.py
======================

Thu âm 5 giây từ microphone, gửi lên backend LUMO Hub (`/api/v1/lumo/audio/`),
nhận WAV phản hồi, lưu ra file và phát lại để kiểm tra âm thanh đúng hay không.

Mục đích: smoke-test end-to-end của luồng STT -> LLM -> TTS trên máy dev,
không cần ESP32.

Usage (PowerShell):
    python record_and_send.py                              # không cần auth, mặc định
    python record_and_send.py --email admin@luminostech.tech --password "Admin@123"
    python record_and_send.py --token eyJhbGciOi...        # dùng token có sẵn

    # nghe lại file local để so sánh với response:
    python record_and_send.py --play-local

    # bật log HTTP chi tiết (DNS/connect/TLS/send/TTFB) để debug latency:
    python record_and_send.py --verbose

Env:
    BACKEND_URL  mặc định http://127.0.0.1:8000
    DURATION     mặc định 5 (giây)

Dependencies (cài thêm nếu thiếu):
    pip install sounddevice soundfile numpy requests
"""

from __future__ import annotations

import argparse
import base64
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
DEFAULT_BACKEND = os.getenv("BACKEND_URL", "https://api.luminostech.tech")
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


def send_audio(token: str | None, backend: str, wav_path: Path, verbose: bool = False) -> dict:
    """Upload lên /api/v1/lumo/audio/, trả về JSON đã decode.

    Mặc định KHÔNG gửi Authorization (route public). Nếu có token thì tự gửi kèm.

    In log chi tiết để debug latency pipeline (DNS/connect/TLS/send/TTFB/recv):
      - request body size, response Content-Length, response headers
      - TTFB (time-to-first-byte) — khoảng cách từ POST tới byte đầu tiên
      - progress nhận body theo chunk
    """
    url = f"{backend}/api/v1/lumo/audio/"
    headers = {
        # BẮT BUỘC để backend trả JSON (mặc định */* sẽ bị backend hiểu nhầm là raw WAV)
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    file_size = wav_path.stat().st_size
    print(f"[UPLOAD] POST {url}  ({file_size} bytes)")
    if token:
        print(f"[UPLOAD] headers: Authorization=Bearer ****  Accept=application/json")
    else:
        print(f"[UPLOAD] headers: (no auth, public route)  Accept=application/json")

    if verbose:
        # Bật log http.client / urllib3 ở mức INFO (in dòng "send:" "reply:")
        import http.client as _hc
        _hc.HTTPConnection.debuglevel = 1

    t0 = time.time()

    # TTFB hook: requests gọi "response" hook NGAY khi urllib3 nhận được byte
    # đầu tiên từ socket → khoảng cách từ POST tới đây là Time To First Byte.
    ttfb_holder = {"t": None}

    def _on_response(r, *args, **kwargs):
        ttfb_holder["t"] = time.time()
        return r

    session = requests.Session()
    session.hooks["response"].append(_on_response)

    try:
        with open(wav_path, "rb") as f:
            r = session.post(
                url,
                headers=headers,
                files={"audio": (wav_path.name, f, "audio/wav")},
                timeout=120,
                stream=True,                  # không buffer body → in chunk progress
            )
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - t0
        print(f"[UPLOAD][ERROR] request failed after {elapsed:.1f}s: {e!r}")
        raise

    # Đã có headers từ server → in
    t_headers = time.time()
    print(f"[UPLOAD] status headers received in {t_headers - t0:.3f} s")
    if ttfb_holder["t"] is not None:
        ttfb = ttfb_holder["t"] - t0
        print(f"[UPLOAD] TTFB (time-to-first-byte) = {ttfb:.3f} s")
    print(f"[UPLOAD] --- response headers ---")
    for k, v in r.headers.items():
        print(f"[UPLOAD]   {k}: {v}")

    if r.status_code != 200:
        # Đọc phần body đã nhận để xem lỗi
        err_body = r.content[:500].decode("utf-8", errors="replace")
        elapsed = time.time() - t0
        print(f"[UPLOAD][ERROR] HTTP {r.status_code} after {elapsed:.1f}s")
        print(f"[UPLOAD][ERROR] body (first 500): {err_body}")
        raise SystemExit(f"Upload failed with HTTP {r.status_code}")

    # Đọc body theo chunk để thấy server stream từng phần
    chunks = []
    bytes_done = 0
    last_print_ts = 0.0
    for chunk in r.iter_content(chunk_size=8192):
        if not chunk:
            continue
        chunks.append(chunk)
        bytes_done += len(chunk)
        now = time.time()
        if now - last_print_ts > 0.3 or bytes_done % (64 * 1024) < 8192:
            elapsed = now - t0
            print(f"[UPLOAD]   received {bytes_done:>8} bytes  ({elapsed:6.2f}s)")
            last_print_ts = now

    body_bytes = b"".join(chunks)
    elapsed = time.time() - t0
    print(f"[UPLOAD] HTTP {r.status_code}  total {bytes_done} bytes  ({elapsed:.2f}s)")

    # Backend có 2 dạng trả về:
    #   - thành công: JSON {audio_base64, mime_type, stt_text, response_text}
    #   - lỗi: JSON {"detail": "..."}
    try:
        payload = json.loads(body_bytes)
    except json.JSONDecodeError:
        print("[UPLOAD][ERROR] non-JSON response:")
        print(body_bytes[:500].decode("utf-8", errors="replace"))
        raise

    if "audio_base64" not in payload:
        print("[UPLOAD][ERROR] missing audio_base64:", payload)
        raise SystemExit("Bad response shape")

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
    g.add_argument("--token", help="Access token (tùy chọn — bỏ qua thì gửi anonymous)")
    p.add_argument("--email", help="Email để login (tùy chọn)")
    p.add_argument("--password", help="Password để login (tùy chọn)")
    p.add_argument("--duration", type=float, default=DEFAULT_DURATION, help="Thời gian thu (giây)")
    p.add_argument("--backend", default=DEFAULT_BACKEND, help="Backend base URL")
    p.add_argument("--out", default=str(RESPONSE_PATH), help="File output WAV từ server")
    p.add_argument("--local-out", default=str(LOCAL_RECORD_PATH), help="File WAV local")
    p.add_argument("--play-local", action="store_true", help="Phát lại file local trước khi gửi")
    p.add_argument("--no-play", action="store_true", help="Không phát response sau khi nhận")
    p.add_argument("--verbose", action="store_true",
                   help="In log HTTP chi tiết (DNS/connect/TLS/send) + TTFB + chunk progress")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    # allow global RESPONSE_PATH override
    global RESPONSE_PATH
    RESPONSE_PATH = Path(args.out)
    local_path = Path(args.local_out)

    # 1. Auth — optional, route /api/v1/lumo/audio/ là public, không bắt buộc.
    #    Chỉ cần login khi người dùng tự cung cấp --token hoặc --email/--password.
    token: str | None = None
    if args.token:
        token = args.token
        print("[AUTH] using provided token")
    elif args.email and args.password:
        token = login(args.email, args.password, args.backend)
    else:
        print("[AUTH] no credentials given → sending as anonymous (route is public)")

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
    payload = send_audio(token, args.backend, local_path, verbose=args.verbose)

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
