#!/usr/bin/env python3
"""Fetch the automatic Base64 WAV export from an ESP32 UART."""

import argparse
import base64
import binascii
import re
import sys
import time

try:
    import serial
except ImportError as exc:
    raise SystemExit("Missing pyserial. Install with: python -m pip install pyserial") from exc


BEGIN_RE = re.compile(r"===B64BEGIN===\s+size=(\d+)")
END_MARKER = "===B64END==="


def reset_board(port: serial.Serial) -> None:
    """Toggle the ESP32 auto-reset lines used by most USB-UART adapters."""
    port.dtr = False
    port.rts = True
    time.sleep(0.1)
    port.dtr = True
    port.rts = False
    time.sleep(0.2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export record.wav over ESP32 UART")
    parser.add_argument("port", help="serial port, for example COM6")
    parser.add_argument(
        "--out",
        "--output",
        dest="output",
        default="record_from_board.wav",
        help="output WAV path (default: record_from_board.wav)",
    )
    parser.add_argument("--timeout", type=float, default=60.0, help="read timeout in seconds")
    args = parser.parse_args()

    started = time.monotonic()
    payload_lines = []
    expected_size = None
    collecting = False
    received_end = False

    try:
        with serial.Serial(args.port, 115200, timeout=0.25) as port:
            port.reset_input_buffer()
            reset_board(port)

            while time.monotonic() - started < args.timeout:
                raw_line = port.readline()
                if not raw_line:
                    continue

                line = raw_line.decode("ascii", errors="ignore").strip()
                begin = BEGIN_RE.search(line)
                if begin:
                    expected_size = int(begin.group(1))
                    payload_lines.clear()
                    collecting = True
                    continue

                if collecting and END_MARKER in line:
                    received_end = True
                    break

                if collecting:
                    # Ignore ESP-IDF log lines; accept only a complete Base64 line.
                    if re.fullmatch(r"[A-Za-z0-9+/=]{1,76}", line):
                        payload_lines.append(line)
            else:
                raise TimeoutError("did not receive ===B64BEGIN===/===B64END=== within timeout")

    except (serial.SerialException, OSError) as exc:
        print(f"Serial error: {exc}", file=sys.stderr)
        return 1
    except TimeoutError as exc:
        print(f"Timeout: {exc}", file=sys.stderr)
        return 1

    if expected_size is None or not collecting or not received_end:
        print("Error: incomplete UART Base64 export (missing marker)", file=sys.stderr)
        return 1

    try:
        decoded = base64.b64decode("".join(payload_lines), validate=True)
    except (ValueError, binascii.Error):
        print("Error: invalid Base64 received from board", file=sys.stderr)
        return 1

    if len(decoded) != expected_size:
        print(
            f"Error: decoded size {len(decoded)} does not match marker size {expected_size}",
            file=sys.stderr,
        )
        return 1

    if len(decoded) < 12 or decoded[:4] != b"RIFF" or decoded[8:12] != b"WAVE":
        print("Error: exported file is not a RIFF/WAVE file", file=sys.stderr)
        return 1

    with open(args.output, "wb") as output_file:
        output_file.write(decoded)

    print(f"Saved {args.output}: {len(decoded)} bytes (RIFF/WAVE OK)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
