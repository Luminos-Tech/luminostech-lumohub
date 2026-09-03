# RECORD.WAV FIX NOTES

## Nguyen nhan va ket qua fix

Artifact truoc day co 44 byte header bang 0x00 va chi dai 6400 bytes, trong khi
log bao 160044 bytes. Kich thuoc khong cung mot lan ghi cho thay kha nang cao
nhat la dump cu/sai lan boot. Tuy nhien recorder cu cung co hai diem cho phep
bao cao sai: moi fwrite/rewind/fclose khong kiem tra return, va runtime chi
stat size > 44 ma khong verify RIFF. Hai diem nay da duoc sua de file cu khong
the duoc nhan nham la ban ghi moi va WAV loi bi xoa.

## Cac thay doi

- main/record/record.c:67,97-118: them s_record_result, xoa file cu bang
  remove() truoc fopen, check mo file va placeholder header fwrite.
- main/record/record.c:144-174: check mic_read_frame, samples_read==0 va PCM
  fwrite; loi duoc truyen qua s_record_result.
- main/record/record.c:185-218: dung fseek(SEEK_SET), check final header fwrite,
  fflush, fsync(fileno(f)) va fclose. Khong bao thanh cong neu mot buoc loi.
- main/record/record.c:231-252: cleanup dong file loi, xoa file loi va chi ket
  thuc task sau khi da xu ly close; them recorder_get_last_error() tai
  record.c:326-329.
- main/record/record.h:38: cong khai recorder_get_last_error() de runtime nhan
  status cua recorder task.
- main/lumo_runtime.c:325-432: sau khi recorder ket thuc, nhan status, stat,
  doc lai 44 byte va verify RIFF/WAVE/fmt/data, ChunkSize, DataSize, sample
  rate, byte rate, channels, block align, bits va kich thuoc file. Loi log
  dung chuoi WAV header invalid va xoa file. Chi verify pass moi in Record xong
  va MIC_TEST_RECORD_DONE.
- main/mic/mic.c:244-288: moi 500 ms log samples, nonzero, min, max va RMS;
  samples_read==0 log warning.
- C3 khong bi sua trong luot fix nay.

## Thong so bat buoc

- ESP32-S3, build directory build-s3.
- I2S STD Philips, mono 16-bit PCM output.
- Sample rate 16000 Hz, duration 5000 ms.
- Target 80000 samples, 160000 bytes PCM, 160044 bytes WAV.
- SPIFFS offset 0x190000, size 0x270000.

## Ba lenh verify

Chay tren file vua giai nen, khong dung artifact cu:

    python -c "d=open('record.wav','rb').read();print(d[0:4], d[8:12], int.from_bytes(d[4:8],'little'))"

Ket qua mong doi: b'RIFF' b'WAVE' 160036.

    python -c "d=open('record.wav','rb').read();print('nonzero',sum(b!=0 for b in d[44:]))"

Voi mic co tin hieu, nonzero phai lon hon 0; 160044 bytes la kich thuoc mong
doi cho ban ghi 5 giay.

    idf.py -B build-s3 monitor | Select-String "Record xong|header invalid|MIC_TEST_RECORD_DONE"

Thu tu hop le la Record xong roi MIC_TEST_RECORD_DONE; neu header sai phai
chi thay WAV header invalid, khong duoc thay log thanh cong.

## Build verification

Da chay:

    idf.py -B build-s3 build

Target la esp32s3, image duoc tao tai
build-s3/Lumo-LuminosTech.bin, khong co compiler warning/error moi. Chua flash
thiet bi trong luot fix nay.

## Export WAV qua UART

Sau khi header WAV pass, firmware tu dong doc `/spiffs/record.wav` va phat
Base64 qua UART 115200 giua hai marker `===B64BEGIN===` va `===B64END===`.
Chunk doc la 45 byte, moi dong Base64 toi da 60 ky tu. Trong luc stream,
log tag `MIC` va `RECORDER` duoc tam tat de khong lam hong du lieu.

Tren Windows PowerShell, tu thu muc `Lumo-LuminosTech` chay:

    python tools\uart_get_record.py COM6 --output record_from_board.wav

Script se toggle DTR/RTS de reset board, cho record test 5 giay, gom Base64,
ghi WAV ra file dich va kiem tra kich thuoc cung 4 byte `RIFF` va `WAVE`.
