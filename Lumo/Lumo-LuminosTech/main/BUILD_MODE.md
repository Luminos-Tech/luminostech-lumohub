# Build mode

Mặc định đang ở **`button_test`** để bạn test nút nhấn nhanh.

Đổi sang `full` (production) khi đã xong test:

Mở `main/CMakeLists.txt`, dòng:

```cmake
set(MODE "button_test" CACHE STRING "Build mode: full | button_test")
```

Đổi thành:

```cmake
set(MODE "full" CACHE STRING "Build mode: full | button_test")
```

Rồi chạy:

```bash
cd Lumo/Lumo-LuminosTech
idf.py fullclean    # xóa cache cũ
idf.py build flash monitor
```

---

## Hai chế độ

| MODE | File main | Hành vi |
|------|-----------|---------|
| `button_test` | `button_test_main.c` | Tắt WiFi/BLE/mic/OLED/audio/HTTP. Chỉ đọc GPIO42 + in log lên serial. |
| `full` | `Lumo-LuminosTech.c` + `lumo_runtime.c` | Toàn bộ stack như bình thường. |
