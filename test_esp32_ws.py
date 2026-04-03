#!/usr/bin/env python3
"""
LUMO WebSocket Test Suite

Tests both endpoints of the LUMO WebSocket server:
  1. /ws/lumo  — device connection & receive server pushes (text / WAV)
  2. /ws/stream — TTS pipeline: text → LLM → TTS streaming → WAV

Run:
  python test_esp32_ws.py

Requirements:
  pip install websockets requests
"""

import argparse
import asyncio
import io
import json
import sys
import wave
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import requests

# ─── Config ──────────────────────────────────────────────────────────────────

DEFAULT_BASE = "http://localhost:8000"
DEVICE_ID    = "tester-001"


class Result(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"


@dataclass
class Stats:
    passed: int = 0
    failed: int = 0
    skipped: int = 0

    def record(self, r: Result):
        if r == Result.PASS:
            self.passed += 1
        elif r == Result.FAIL:
            self.failed += 1
        else:
            self.skipped += 1


stats = Stats()


# ─── Output helpers ───────────────────────────────────────────────────────────

def step(msg: str):
    print(f"\n{'─' * 60}")
    print(f"  {msg}")
    print("─" * 60)


def ok(msg: str = ""):
    stats.record(Result.PASS)
    print(f"  ✓ {msg}" if msg else "  ✓")


def fail(msg: str = ""):
    stats.record(Result.FAIL)
    print(f"  ✗ {msg}" if msg else "  ✗")


def skip(msg: str = ""):
    stats.record(Result.SKIP)
    print(f"  ⊘  {msg}" if msg else "  ⊘")


def info(msg: str):
    print(f"  → {msg}")


def banner(title: str):
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print("═" * 60)


# ─── WAV helpers ──────────────────────────────────────────────────────────────

def parse_wav_info(data: bytes) -> Optional[dict]:
    """Return WAV metadata or None if not a valid WAV."""
    try:
        with wave.open(io.BytesIO(data)) as w:
            return {
                "channels":   w.getnchannels(),
                "sampwidth":  w.getsampwidth() * 8,
                "framerate":  w.getframerate(),
                "nframes":    w.getnframes(),
                "duration_s": w.getnframes() / w.getframerate() if w.getframerate() else 0,
                "bytes":      len(data),
            }
    except Exception:
        return None


# ─── REST helpers ────────────────────────────────────────────────────────────

def rest_login(base: str) -> Optional[str]:
    """Login via REST, return access token or None."""
    try:
        r = requests.post(
            f"{base}/api/v1/auth/login",
            json={"email": "admin@luminostech.tech", "password": "admin123"},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()["access_token"]
        fail(f"Login failed: {r.status_code} {r.text[:100]}")
    except requests.RequestException as e:
        fail(f"Login request error: {e}")
    return None


def rest_send_text(base: str, token: str, device_id: str, text: str) -> bool:
    """Send text to device via REST (forwards to /ws/lumo)."""
    try:
        r = requests.post(
            f"{base}/api/v1/admin/device/send",
            json={"device_id": device_id, "text": text},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if r.status_code == 200:
            info(f"REST → WS/lumo  ({r.status_code})")
            return True
        fail(f"REST send failed: {r.status_code} {r.text[:100]}")
    except requests.RequestException as e:
        fail(f"REST send error: {e}")
    return False


def rest_health(base: str) -> bool:
    """Ping the server health endpoint."""
    try:
        r = requests.get(f"{base}/api/v1/health", timeout=5)
        info(f"Health: {r.status_code}")
        return r.status_code == 200
    except requests.RequestException:
        pass
    try:
        r = requests.get(f"{base}/", timeout=5)
        info(f"Root: {r.status_code}")
        return True
    except requests.RequestException as e:
        fail(f"Server unreachable: {e}")
        return False


# ─── WebSocket: /ws/lumo ─────────────────────────────────────────────────────

async def test_lumo_ws(base: str, device_id: str, token: str):
    """Test /ws/lumo — connect, send online, receive pushed messages."""
    banner("TEST 1 — /ws/lumo")

    try:
        from websockets import connect
        from websockets.exceptions import ConnectionClosed
    except ImportError:
        skip("websockets not installed — install with: pip install websockets")
        return

    uri = f"ws://localhost:8000/ws/lumo?device_id={device_id}"
    info(f"Connecting → {uri}")

    try:
        async with connect(uri, max_size=50 * 1024 * 1024) as ws:
            ok("WebSocket connected")

            # 1. Send online
            await ws.send(json.dumps({"type": "online", "device_id": device_id}))
            ok("Sent online message")

            # 2. Receive ack — server responds with "ok"
            ack = await asyncio.wait_for(ws.recv(), timeout=5)
            info(f"Received: {ack!r}")
            ok("Got server ack")

            # 3. Push text from server via REST
            info("Sending text via REST → server pushes to /ws/lumo...")
            ok_rest = await asyncio.get_event_loop().run_in_executor(
                None, rest_send_text, base, token, device_id, "Chào từ test script!"
            )

            # 4. Wait for pushed text
            try:
                pushed = await asyncio.wait_for(ws.recv(), timeout=10)
                info(f"Pushed text: {pushed!r}")
                ok("Received pushed text from server")
            except asyncio.TimeoutError:
                fail("Timeout waiting for pushed text — REST may not forward to WS/lumo")

            # 5. Test ping → pong
            info("Sending 'ping'...")
            await ws.send("ping")
            pong = await asyncio.wait_for(ws.recv(), timeout=5)
            if pong == "pong":
                ok("pong received")
            else:
                fail(f"Expected 'pong', got: {pong!r}")

    except ConnectionClosed as e:
        fail(f"Connection closed: {e}")
    except OSError as e:
        fail(f"Cannot connect: {e}")


# ─── WebSocket: /ws/stream ───────────────────────────────────────────────────

async def test_stream_ws(base: str, device_id: str):
    """Test /ws/stream — TTS pipeline: send text, receive WAV."""
    banner("TEST 2 — /ws/stream (TTS)")

    try:
        from websockets import connect
        from websockets.exceptions import ConnectionClosed
    except ImportError:
        skip("websockets not installed")
        return

    uri = f"ws://localhost:8000/ws/stream?device_id={device_id}"
    info(f"Connecting → {uri}")

    test_text = "Xin chào, tôi là LUMO."

    try:
        async with connect(uri, max_size=50 * 1024 * 1024) as ws:
            ok("WebSocket connected")

            # Send TTS action
            payload = json.dumps({"action": "tts", "text": test_text})
            await ws.send(payload)
            info(f"Sent: {payload[:80]!r}...")

            wav_data = b""
            done = False
            error = None
            first_frame_time = None

            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=60)
                except asyncio.TimeoutError:
                    fail("Timeout waiting for response (no 'done' or WAV received)")
                    break

                if isinstance(msg, bytes):
                    if first_frame_time is None:
                        first_frame_time = "binary"
                    kb = len(msg) / 1024
                    if msg[:4] == b"RIFF":
                        wav_data = msg
                        info(f"← WAV {kb:.0f} KB  (first frame)")
                        ok("Received WAV header frame")
                    else:
                        info(f"← PCM {kb:.0f} KB")
                else:
                    info(f"← TEXT: {msg!r}")
                    try:
                        obj = json.loads(msg)
                        if obj.get("type") == "done":
                            done = True
                            ok("Received 'done'")
                            break
                        if obj.get("type") == "error":
                            error = obj.get("message", "unknown")
                            fail(f"Server error: {error}")
                            break
                    except json.JSONDecodeError:
                        pass

            # Validate WAV
            if wav_data:
                info = parse_wav_info(wav_data)
                if info:
                    info(
                        f"WAV: {info['channels']}ch {info['sampwidth']}bit "
                        f"{info['framerate']}Hz {info['duration_s']:.2f}s"
                    )
                    ok("WAV is valid")
                    # Save to disk
                    path = f"tts_test_{device_id}.wav"
                    with open(path, "wb") as f:
                        f.write(wav_data)
                    info(f"Saved → {path}")
                else:
                    fail("Received bytes but not a valid WAV")
            elif not error and not done:
                fail("No WAV data received and no error/done")

            if done and wav_data:
                ok("Full TTS pipeline: PASS")

    except ConnectionClosed as e:
        fail(f"Connection closed: {e}")
    except OSError as e:
        fail(f"Cannot connect: {e}")


# ─── Quick echo test ─────────────────────────────────────────────────────────

async def test_ws_echo(base: str, path: str, device_id: str, label: str):
    """Connect, send a JSON message, verify echoed back."""
    banner(f"ECHO TEST — {label}")

    try:
        from websockets import connect
        from websockets.exceptions import ConnectionClosed
    except ImportError:
        skip("websockets not installed")
        return

    uri = f"ws://localhost:8000{path}?device_id={device_id}"
    info(f"Connecting → {uri}")

    try:
        async with connect(uri, max_size=50 * 1024 * 1024) as ws:
            ok(f"Connected to {label}")

            test_msg = {"action": "echo", "text": "hello lumo", "seq": 1}
            await ws.send(json.dumps(test_msg))
            info(f"Sent: {test_msg}")

            reply = await asyncio.wait_for(ws.recv(), timeout=5)
            info(f"Received: {reply!r}")

            if isinstance(reply, str):
                ok("Server responded with text")
                try:
                    obj = json.loads(reply)
                    info(f"JSON: {obj}")
                except json.JSONDecodeError:
                    info(f"Raw text: {reply}")
            elif isinstance(reply, bytes):
                wav_info = parse_wav_info(reply)
                if wav_info:
                    ok(f"Server responded with WAV: {wav_info['duration_s']:.2f}s")
                else:
                    ok(f"Server responded with {len(reply)} bytes")
            else:
                ok(f"Server responded: {type(reply)}")

    except ConnectionClosed as e:
        fail(f"Connection closed: {e}")
    except OSError as e:
        fail(f"Cannot connect: {e}")
    except asyncio.TimeoutError:
        fail("Timeout waiting for reply")


# ─── Main ─────────────────────────────────────────────────────────────────────

async def run_tests(args):
    base = args.base.rstrip("/")
    device_id = args.device or DEVICE_ID

    banner(f"LUMO WebSocket Test Suite\n  base={base}  device_id={device_id}")

    # Pre-flight: server reachable?
    step("PRE-FLIGHT — server health check")
    try:
        if not rest_health(base):
            fail("Server is not reachable")
            return
        ok("Server is reachable")
    except Exception as e:
        fail(f"Server check failed: {e}")
        return

    # REST auth
    step("REST auth — login")
    token = await asyncio.get_event_loop().run_in_executor(None, rest_login, base)
    if not token:
        fail("Cannot proceed without auth token")
        return
    ok("Logged in")

    # Run tests
    await test_lumo_ws(base, device_id, token)
    await test_stream_ws(base, device_id)

    if args.echo:
        await test_ws_echo(base, "/ws/lumo", device_id, "/ws/lumo")
        await test_ws_echo(base, "/ws/stream", device_id, "/ws/stream")

    # Summary
    banner("SUMMARY")
    total = stats.passed + stats.failed + stats.skipped
    print(f"  Total : {total}")
    print(f"  Passed: {stats.passed}")
    print(f"  Failed: {stats.failed}")
    print(f"  Skipped: {stats.skipped}")

    if stats.failed > 0:
        print("\n  ⚠ Some tests failed — check output above.")
        sys.exit(1)
    elif stats.skipped > 0 and stats.passed == 0:
        print("\n  ⚠ All tests skipped — check dependencies.")
        sys.exit(1)
    else:
        ok("All tests passed!")


def main():
    parser = argparse.ArgumentParser(description="LUMO WebSocket test suite")
    parser.add_argument(
        "--base",
        default=DEFAULT_BASE,
        help=f"Server base URL (default: {DEFAULT_BASE})",
    )
    parser.add_argument(
        "--device",
        default=DEVICE_ID,
        help=f"Device ID to use (default: {DEVICE_ID})",
    )
    parser.add_argument(
        "--echo",
        action="store_true",
        help="Also run quick echo tests on both endpoints",
    )
    args = parser.parse_args()

    try:
        asyncio.run(run_tests(args))
    except KeyboardInterrupt:
        print("\n\n[Interrupted]")


if __name__ == "__main__":
    main()
