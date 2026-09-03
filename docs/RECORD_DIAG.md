# RECORD.WAV DIAGNOSTIC REPORT

## 1. Tom tat trieu chung

Log duoc bao cao noi recorder da ghi 5 giay, 160000 bytes PCM va
MIC_TEST_RECORD_DONE bytes=160044. Artifact hien co tai
Lumo/Lumo-LuminosTech/output/decoded/record.wav chi dai 6400 bytes; 44 bytes
dau la 0x00 toan bo, khong co RIFF/WAVE/fmt/data. Phan sau header co PCM
khac 0. Day la file khong phai WAV hop le va khong trung voi kich thuoc 5 giay.

Khong tim thay decode script trong output. Ban mkspiffs Linux nam trong repo
da giai nen image size 0x270000 va xuat duoc cac file WAV khac. Do do kha nang
cao loi nam o artifact/header hoac file cu, khong nam o viec cat SPIFFS.

## 2. Evidence theo file

### Mount SPIFFS va partition

- main/lumo_runtime.c:156-165: mount /spiffs bang esp_vfs_spiffs_register(),
  partition_label=NULL, max_files=5, format_if_mount_failed=true.
- main/lumo_runtime.c:171-177: goi esp_spiffs_info() va log total/used.
- partitions.csv:2-5:
      factory, app, factory, 0x10000,  0x180000
      spiffs,  data, spiffs, 0x190000, 0x270000
  Offset va size dump la dung; partition du lon cho file 160044 bytes.
- sdkconfig:393, 592, 2438-2443: target esp32s3, partition table custom
  partitions.csv, SPIFFS page=256, obj-name=32, meta=4, magic va magic-length.

### Mic I2S

- main/lumo_runtime.c:43-45:
      MIC_BCLK_GPIO 15
      MIC_WS_GPIO 16
      MIC_DATA_GPIO 17
- main/lumo_runtime.c:726-746: sample_rate=16000, frame_ms=100, sau do
  mic_init() va mic_start().
- main/mic/mic.c:55-95: I2S_NUM_AUTO, I2S_ROLE_MASTER, Philips STD, slot 32-bit,
  mono, I2S_STD_SLOT_LEFT, din=data_in_num. Day la I2S STD, khong phai PDM.
- main/mic/mic.c:193-239: i2s_channel_read(..., portMAX_DELAY), raw buffer
  int32, samples_read=bytes_read/4, raw_to_pcm16() shift >>16, tra ESP_OK.
  Code khong bao loi khi samples_read==0 va khong log nonzero/min/max.

### Recorder va WAV header

- main/record/record.c:20-37: wav_header_t duoc bao boi
  #pragma pack(push, 1), kich thuoc 44 bytes.
- main/record/record.c:39-55: wav_header_fill() dat RIFF/WAVE/fmt/data,
  audio_format=1, channels=1, sample_rate, bits=16, block_align=2,
  byte_rate=sample_rate*2, riff_size=36+data_bytes, data_size=data_bytes.
  Target little-endian nen cac so nguyen duoc ghi little-endian dung WAV.
- main/record/record.c:93-102:
      f = fopen(s_cfg.output_path, "wb");
      wav_header_t header = {0};
      fwrite(&header, sizeof(wav_header_t), 1, f);
  File mo binary va viet placeholder 44 byte zero.
- main/record/record.c:104-151: target_samples =
  sample_rate*duration_ms/1000. Voi 16000 Hz va 5000 ms la 80000 samples,
  160000 byte PCM; frame cuoi duoc clip neu vuot target.
- main/record/record.c:154-167:
      data_bytes = total_written * sizeof(int16_t);
      rewind(f);
      wav_header_fill(&header, sample_rate, data_bytes);
      fwrite(&header, sizeof(wav_header_t), 1, f);
      fclose(f);
      ESP_LOGI(TAG, "Record xong: ...");
  Header duoc rewrite truoc fclose va log. Khong co fflush rieng, nhung
  fclose() phai flush stdio. Return cua rewind/fwrite/fclose khong duoc kiem tra.
- main/record/record.c:175-179: chi sau cleanup moi dat s_recording=false va
  give semaphore.
- main/record/record.c:188-224: recorder_start() validate path/rate, yeu cau
  mic_is_running(), tao recorder_task stack 4096.
- main/lumo_runtime.c:325-358: run_microphone_record_test() dung
  /spiffs/record.wav, 16000 Hz, 5000 ms; doi recorder ket thuc, chi stat size
  >44, roi in MIC_TEST_RECORD_DONE. No khong verify RIFF/header va khong nhan
  status loi tu recorder.

### Runtime startup va decode

- main/Lumo-LuminosTech.c:7-12: storage=true, microphone=true,
  microphone_level_log=false, microphone_record_test=true.
- main/lumo_runtime.c:799-817: initialize_enabled_features() xong moi goi
  run_microphone_record_test_in_task(); test chay trong task rieng stack 12288
  va main task cho semaphore tai main/lumo_runtime.c:376-401.
- Decode duoc thuc hien bang
  Lumo/mkspiffs-0.2.3-esp-idf-linux64/mkspiffs -u output/decoded/
  -s 0x270000 output/spiffs.bin. Khong co script decode trong output.
- Artifact hien tai:
  output/spiffs.bin = 2555904 bytes = 0x270000
  output/decoded/record.wav = 6400 bytes
  record.wav header bytes 0..43 = 44 byte 0x00
  PCM bytes 44.. = 6356; nonzero_bytes=5422; samples=3178
  min=-3094, max=624, RMS=512.17
  Cac file beep.wav, checkLife.wav, LumoHello.wav, off.wav giai nen duoc.

## 3. Hypotheses (cao -> thap)

| Gia thuyet | Evidence (file:line) | Cach kiem chung | Xac suat |
|---|---|---|---:|
| Dump/decode dang dung file cu, sai lan boot, hoac sai thiet bi | Artifact chi 6400 bytes; source spiffs khong co record.wav; log mong doi 160044 | Boot moi, doi BEGIN -> Record xong -> DONE, doc flash lai; ghi timestamp/hash spiffs.bin; so sanh size record | 45% |
| Recorder bi reset/power loss truoc finalize header | record.c:100-102 viet header zero truoc; record.c:154-159 chi finalize sau loop | Tim panic/reset/WDT trong cung log; neu khong co Record xong thi zero header phu hop | 25% |
| Rewind/fwrite header that bai nhung bi bo qua | record.c:156-159 khong kiem tra return; runtime:349-357 chi stat size | Buoc FIX them return-code logs va reopen doc 44 byte tren device | 15% |
| Decode tool sai config/cat sai partition | partitions.csv:5 va raw image khop; cac WAV khac giai nen duoc | Chay lai dung page=256, obj=32, meta=4, magic va hash raw image | 8% |
| Mic tra PCM zero/garbage | mic.c:214-239 tra ESP_OK theo bytes_read; artifact co 5422 PCM byte khac zero | Log samples_read, nonzero, min/max, RMS moi frame; tinh thong ke file moi | 7% |

## 4. Ket luan

Header artifact hien tai chac chan bi hong: 44 byte zero khong the mo bang
trinh phat WAV. PCM khong phai toan zero, vi co 5422 byte khac zero va RMS
512.17, nhung artifact chi co 3178 samples, khong phai ban ghi 5 giay. Chua
du co so ket luan am thanh la tin hieu that hay chi la nhieu.

Neu cac dong Record xong 5.00 giay | 160000 bytes va MIC_TEST_RECORD_DONE
bytes=160044 thuoc cung mot lan boot/cung image, code hien tai tao mau thuan:
fclose() da chay sau khi rewrite header, nen header zero khong nen xuat hien.
Kha nang cao nhat la dang phan tich dump cu/sai lan, hoac log va artifact
khong thuoc cung mot lan chay. SPIFFS mount va partition size khong phai nghi
pham chinh.

## 5. Checklist 3 lenh chot nhanh

1. Kiem tra header, size va PCM nonzero tren file vua decode:

       python -c "from pathlib import Path; p=Path(r'output\\decoded\\record.wav'); d=p.read_bytes(); print('size',len(d),'header',d[:44].hex(' '),'pcm_nonzero',sum(b!=0 for b in d[44:]))"

   Nhanh A (chi loi header): size=160044, header bat dau 52 49 46 46 va
   pcm_nonzero > 0. Nhanh B (mic/record loi): PCM gan nhu toan zero.

2. Dump 64 byte PCM dau sau header:

       python -c "from pathlib import Path; d=Path(r'output\\decoded\\record.wav').read_bytes(); print(d[44:108].hex(' '))"

3. Loc log cua cung lan boot:

       Select-String -Path .\\monitor.log -Pattern 'MIC_TEST_RECORD_BEGIN|mic_read_frame|Record xong|MIC_TEST_RECORD_DONE|panic|reset|WDT'

   Thu tu can co: BEGIN -> Record xong -> DONE, khong co reset/panic o giua.

## 6. Khung prompt FIX (chua thuc hien)

Fix recorder WAV tren Hub ESP32-S3, chi sua Lumo-LuminosTech.
- Khong sua Lumo-Band C3.
- Kiem tra return cua placeholder fwrite, fseek/rewind, final header fwrite,
  fflush, fsync neu VFS ho tro, va fclose.
- Chi in Record xong/MIC_TEST_RECORD_DONE khi ghi header va dong file thanh cong.
- Xoa record.wav cu hoac dung temp path moi truoc moi lan test de tranh stat
  nham file cu.
- Sau khi dong file, reopen record.wav, doc 44 byte, verify RIFF/WAVE/fmt/data,
  data_size va kich thuoc file.
- Trong mic_read_frame/recorder, log samples_read, nonzero_count, min, max,
  RMS cua mot frame; bao loi neu samples_read==0.
- Giu sample rate 16000, mono PCM16, duration 5000 ms, SPIFFS offset/size.
- Verify bang idf.py -B build-s3 build; khong flash.

Bao cao nay chi doc source va artifact; khong build, khong flash, khong sua
firmware.
