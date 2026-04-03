#!/usr/bin/env python3
"""Website simulator → gửi text đến ESP32 qua REST endpoint."""

import requests

BASE_URL = "http://localhost:8000/api/v1"
TOKEN = "your_admin_token_here"  # thay bằng token admin thật


def send_text(device_id: str, text: str):
    resp = requests.post(
        f"{BASE_URL}/admin/device/send",
        json={"device_id": device_id, "text": text},
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    print(f"[HTTP {resp.status_code}] {resp.json()}")
    return resp.ok


if __name__ == "__main__":
    print("Website simulator — gửi text đến ESP32...")
    send_text("0001", "xin chao esp32!")
