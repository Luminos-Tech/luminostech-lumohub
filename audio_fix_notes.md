# Audio fix notes for `lumo.py`

## Vấn đề ban đầu
File `response.wav` trả về từ endpoint audio ở `backend/app/routes/lumo.py` bị rè, có tiếng đùng đùng.

Trong khi đó `test_audio.py` cho audio mượt hơn.

---

## Nguyên nhân gốc
Nguyên nhân chính không nằm ở STT hay prompt, mà nằm ở **cách backend xử lý dữ liệu audio trả về từ Gemini TTS**.

### 1. Hiểu sai `inline_data.data`
Trong luồng TTS của backend, `inline_data.data` được xử lý như thể đó là **PCM raw bytes**.

Nhưng thực tế ở case này, dữ liệu trả về là **base64-encoded audio bytes**.

Hậu quả:
- backend lấy dữ liệu base64 đó bọc thẳng thành WAV
- WAV vẫn tạo được file
- nhưng nội dung thực chất không phải sóng âm PCM thật
- nên khi phát ra sẽ bị rè, nổ, méo tiếng

---

## Những gì đã fix

### Fix 1: bỏ logic “chỉnh offset” PCM
Trước đó hàm `_pcm_to_wav()` có xử lý thêm:
- parse sample `int16`
- tìm `silence_value`
- trừ offset trên toàn bộ waveform

Ý tưởng là khử noise/DC offset, nhưng thực tế làm méo tín hiệu.

Đã sửa lại để hàm này chỉ làm đúng một việc:
- nhận PCM raw bytes
- ghi ra file WAV

### Fix 2: thêm hàm decode audio thực tế từ Gemini
Đã thêm hàm:
- `_extract_inline_audio_bytes()`

Hàm này xử lý như sau:
1. nếu dữ liệu là `str` -> base64 decode
2. nếu dữ liệu là `bytes` nhưng thực chất là ASCII base64 -> decode
3. nếu không phải base64 -> giữ nguyên bytes gốc

Mục tiêu là luôn chuyển `inline_data.data` về **audio bytes thật** trước khi ghi file.

### Fix 3: xử lý đúng theo `mime_type`
Đã sửa nhánh ghi file:

- nếu `mime_type == "audio/wav"`
  - ghi thẳng bytes ra file
- nếu là `audio/L16` hoặc `audio/pcm`
  - coi là PCM raw
  - bọc thành WAV bằng `wave.open(...)`

Ngoài ra còn parse `rate=...` từ mime như:
- `audio/L16;codec=pcm;rate=24000`

để dùng đúng sample rate.

---

## Vì sao `test_audio.py` nghe tốt hơn trước đó
Vì `test_audio.py` gần với luồng đúng hơn:
- lấy dữ liệu audio
- ghi WAV đơn giản
- không làm thêm bước “sửa waveform”

Backend cũ thì vừa hiểu sai dữ liệu, vừa can thiệp vào sample nên làm hỏng audio.

---

## File đã sửa
- `backend/app/routes/lumo.py`

---

## Các đoạn quan trọng sau khi sửa

### 1. `_pcm_to_wav()`
Chỉ ghi PCM raw vào WAV, không chỉnh sample.

### 2. `_sample_rate_from_mime()`
Tách sample rate từ mime type.

Ví dụ:
- `audio/L16;codec=pcm;rate=24000`

### 3. `_extract_inline_audio_bytes()`
Phát hiện và decode base64 nếu cần.

### 4. pipeline TTS trong endpoint `/api/v1/lumo/audio/`
Thay vì ghi trực tiếp `inline_data.data`, giờ sẽ:
1. lấy `raw_audio`
2. decode thành `audio_bytes`
3. ghi `audio_bytes` theo `mime_type`

---

## Bài học rút ra

### 1. Đừng giả định dữ liệu audio trả về luôn là PCM raw
Nhiều SDK/API có thể trả:
- bytes raw
- base64 string
- bytes chứa ASCII base64
- file WAV hoàn chỉnh

Luôn kiểm tra kỹ `mime_type` và định dạng thật của payload.

### 2. Nếu một file audio “phát được nhưng nghe rất rè”
Thì thường là do:
- sai sample rate
- sai sample width
- sai endianness
- hoặc dữ liệu không phải PCM thật nhưng bị ép thành PCM

### 3. Tránh “xử lý thông minh” khi chưa chắc format
Nếu nguồn audio đã đúng, việc tự shift offset / normalize sai cách có thể làm tín hiệu hỏng nặng hơn.

---

## Cách debug kiểu này lần sau

### Bước 1: so sánh file tốt và file lỗi
Kiểm tra:
- sample rate
- sample width
- channels
- số frame
- vài bytes đầu
- phân bố sample

### Bước 2: nghi ngờ format trước khi nghi model
Nếu TTS model vẫn chạy, nhưng audio méo nặng, hãy kiểm tra:
- `mime_type`
- payload có phải base64 không
- payload có phải WAV hoàn chỉnh không

### Bước 3: giữ pipeline càng tối giản càng tốt
Quy tắc tốt:
- nếu là WAV -> ghi thẳng
- nếu là PCM -> bọc WAV
- không chỉnh waveform nếu chưa có lý do chắc chắn

---

## Kết luận
Lỗi rè không phải do model TTS kém, mà do backend đã:
1. hiểu sai định dạng audio trả về
2. và trước đó còn xử lý sample sai logic

Sau khi decode đúng payload và ghi WAV đúng format, `response.wav` đã trở lại bình thường.
