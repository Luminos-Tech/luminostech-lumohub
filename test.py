import requests

API_URL = "http://localhost:8000/api/v1/lumo/audio/"
AUDIO_FILE = "test.wav"          # đổi thành đường dẫn file audio của bạn
OUTPUT_FILE = "response.wav"     # file audio server trả về

def test_lumo_audio():
    try:
        with open(AUDIO_FILE, "rb") as f:
            files = {
                "audio": (AUDIO_FILE, f, "audio/wav")
            }

            print(f"Đang gửi file: {AUDIO_FILE}")
            resp = requests.post(API_URL, files=files, timeout=300)

        print("Status code:", resp.status_code)
        print("Content-Type:", resp.headers.get("content-type"))

        if resp.status_code == 200:
            with open(OUTPUT_FILE, "wb") as out:
                out.write(resp.content)
            print(f"Đã lưu file phản hồi vào: {OUTPUT_FILE}")
        else:
            try:
                print("Lỗi JSON:", resp.json())
            except Exception:
                print("Lỗi text:", resp.text)

    except FileNotFoundError:
        print(f"Không tìm thấy file audio: {AUDIO_FILE}")
    except requests.exceptions.RequestException as e:
        print("Lỗi request:", e)

if __name__ == "__main__":
    test_lumo_audio()