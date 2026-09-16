# -*- coding: utf-8 -*-
"""
spiffs_extract.py - giai file trong SPIFFS image ra PC, khong can mkspiffs.

Cach chay (PowerShell, thu muc Lumo-LuminosTech):
    python tools\spiffs_extract.py output\spiffs.bin output\decoded
"""
import os
import struct
import sys

PG = 256
OBJ_NAME_LEN = 32


def is_printable_name(s):
    if not s:
        return False
    return all(32 <= ord(c) < 127 for c in s)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else r"output\spiffs.bin"
    outdir = sys.argv[2] if len(sys.argv) > 2 else r"output\decoded"

    d = open(path, "rb").read()
    n_pages = len(d) // PG

    # Luot 1: object header pages (type 0 nam tai byte 4)
    objs = {}
    for p in range(n_pages):
        b = d[p * PG:(p + 1) * PG]
        magic, span = struct.unpack_from("<HH", b, 0)
        typ = b[4]
        flags = b[5]
        if magic not in (0x4551, 0x4552):
            continue
        if typ != 0:
            continue
        # obj header: obj_id @8, size @12, offset @16, name @20
        obj_id, size, _off = struct.unpack_from("<III", b, 8)
        name = b[20:20 + OBJ_NAME_LEN].split(b"\x00")[0].decode(errors="replace")
        if not is_printable_name(name):
            continue
        if size > 0x300000:
            continue
        objs[obj_id] = [name, span, size, {}]

    # Luot 2: data pages (type 1): obj_id @8, ix @12, payload @16 (240 bytes)
    for p in range(n_pages):
        b = d[p * PG:(p + 1) * PG]
        magic = struct.unpack_from("<H", b, 0)[0]
        typ = b[4]
        if magic not in (0x4551, 0x4552) or typ != 1:
            continue
        obj_id, ix = struct.unpack_from("<II", b, 8)
        if obj_id in objs:
            objs[obj_id][3][ix] = b[16:16 + (PG - 16)]

    os.makedirs(outdir, exist_ok=True)
    if not objs:
        print("Khong thay object hop le nao trong image.")
        return

    print(f"Tim thay {len(objs)} file trong {path}")
    for obj_id, (name, span, size, pages) in sorted(objs.items(), key=lambda kv: kv[1][0]):
        data = bytearray()
        for ix in range(len(pages)):
            if ix in pages:
                data += pages[ix]
            else:
                print(f"  CANH BAO: {name} thieu data page ix={ix}")
        payload = bytes(data[:size]) if size else bytes(data)
        clean = name.replace("/", "_").strip()
        fn = os.path.join(outdir, clean)
        try:
            open(fn, "wb").write(payload)
            miss = "" if len(pages) == span else f" (pages {len(pages)}/{span})"
            print(f"  {name}: obj_id={obj_id} {len(payload)} bytes{miss} -> {fn}")
        except OSError as e:
            print(f"  bo qua {name!r}: {e}")

    rec = os.path.join(outdir, "record.wav")
    if os.path.exists(rec):
        r = open(rec, "rb").read()
        ok = r[:4] == b"RIFF" and r[8:12] == b"WAVE"
        print(f"\n[VERIFY] record.wav size={len(r)} RIFF={r[:4]!r} "
              f"WAVE={r[8:12]!r} "
              f"data_size={int.from_bytes(r[40:44], 'little')} -> "
              + ("HEADER OK, mo VLC nghe thu" if ok else "HEADER VAN HONG"))


if __name__ == "__main__":
    main()