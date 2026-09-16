"""Generate a QR code for pairing a LUMO device."""

import argparse
import json
import re
from pathlib import Path

import qrcode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a LUMO device pairing QR code."
    )
    parser.add_argument("device_id", nargs="?", help="Exactly 4 digits, e.g. 0001")
    parser.add_argument("device_name", nargs="?", help='Device name, e.g. "Lumo Hub"')
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output PNG path (default: lumo_device_<device_id>.png)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    device_id = args.device_id or input("Device ID (4 digits): ").strip()
    device_name = args.device_name or input("Device name [Lumo Hub]: ").strip()
    device_name = device_name or "Lumo Hub"

    if not re.fullmatch(r"\d{4}", device_id):
        raise SystemExit("Error: device_id must contain exactly 4 digits.")

    payload = json.dumps(
        {"device_id": device_id, "device_name": device_name},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    output_path = args.output or Path(f"lumo_device_{device_id}.png")
    if output_path.suffix.lower() != ".png":
        raise SystemExit("Error: output file must have a .png extension.")

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    image.save(output_path)

    print(f"Created: {output_path.resolve()}")
    print(f"QR data: {payload}")


if __name__ == "__main__":
    main()
