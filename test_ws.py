#!/usr/bin/env python3
"""
ESP32 Simulator Script
Giả lập thiết bị ESP32: kết nối đến server, lắng nghe các lệnh điều khiển, 
nhận văn bản thông báo và nhận PCM audio (TTS) từ server.

Cách dùng:
  python test_ws.py                 # device_id = 0001 mặc định
  python test_ws.py my_esp32_dev    # chỉ định device_id tuỳ ý
"""

import sys
import json
import time
import asyncio

try:
    import websockets
except ImportError:
    print("❌ Cần cài websockets: pip install websockets")
    sys.exit(1)

# Lấy device_id từ args, mặc định "0001" 
# (vì web đang test với 0001)
DEVICE_ID = sys.argv[1] if len(sys.argv) > 1 else "0001"
BASE_URL = "ws://localhost:8000"

GREEN = "\033[92m"
BEIGE = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
RESET = "\033[0m"
DIM = "\033[2m"

def log(tag, msg, color=RESET):
    ts = time.strftime("%H:%M:%S")
    print(f"  {DIM}{ts}{RESET} {color}[{tag}]{RESET} {msg}")

async def listen_to_server():
    url = f"{BASE_URL}/ws/lumo?device_id={DEVICE_ID}"
    log("INFO", f"Đang kết nối tới server với tư cách là ESP32 ({url}) ...", CYAN)

    while True:
        try:
            # 1. Mở kết nối
            async with websockets.connect(url, max_size=10 * 1024 * 1024) as ws:
                log("INFO", "✅ Đã kết nối thành công. Đang chờ lệnh và tin nhắn từ web!", GREEN)
                
                # ESP32 gửi msg online tùy chọn
                await ws.send(json.dumps({"type": "online", "device_id": DEVICE_ID}))
                
                # 2. Vòng lặp nhận dữ liệu
                while True:
                    resp = await ws.recv()

                    if isinstance(resp, bytes):
                        # Nhận được một cục Binary (chắc chắn là Audio PCM / WAV)
                        size_kb = round(len(resp) / 1024, 1)
                        is_wav = resp[:4] == b"RIFF" and resp[8:12] == b"WAVE"
                        
                        file_name = f"lumo_audio_{int(time.time())}.wav" if is_wav else f"lumo_pcm_{int(time.time())}.raw"
                        with open(file_name, "wb") as f:
                            f.write(resp)
                            
                        audio_type = "WAV Audio" if is_wav else "RAW PCM"
                        log("AUDIO", f"🔊 Nhận file {audio_type} ({size_kb} KB) -> Đã lưu vào {file_name}", BEIGE)
                        
                    elif isinstance(resp, str):
                        # Nhận được Text (thông báo / json / ping)
                        if resp == "ping":
                            # Trả lời máy chủ
                            await ws.send("pong")
                            log("PING", "Nhận ping, đã phản hồi pong", DIM)
                        else:
                            log("TEXT", f"📩 Tin nhắn từ web: {resp}", GREEN)

        except websockets.exceptions.ConnectionClosed:
            log("ERROR", "❌ Mất kết nối. Thử lại sau 3 giây...", RED)
            await asyncio.sleep(3)
        except ConnectionRefusedError:
            log("ERROR", "❌ Server chưa mở (Connection Refused). Thử lại sau 3 giây...", RED)
            await asyncio.sleep(3)
        except Exception as e:
            log("ERROR", f"❌ Lỗi: {e}. Thử lại sau 3 giây...", RED)
            await asyncio.sleep(3)

if __name__ == "__main__":
    print(f"\n{CYAN}==================================={RESET}")
    print(f"{GREEN}   TRÌNH GIẢ LẬP ESP32 NHẬN LỆNH   {RESET}")
    print(f"{CYAN}==================================={RESET}\n")
    try:
        asyncio.run(listen_to_server())
    except KeyboardInterrupt:
        print(f"\n{DIM}👋 Đã tắt thiết bị giả lập.{RESET}\n")
