"""diag_prod.py — chẩn đoán nhanh backend production.

Chạy nhiều test tuần tự, in PASS/FAIL với giải thích để biết đoạn nào chết.

Usage:
    python diag_prod.py                                # dùng BACKEND_URL env, mặc định prod
    python diag_prod.py --backend http://127.0.0.1:8000  # test local
    python diag_prod.py --email admin@luminostech.tech --password "Admin@123"
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import time

import requests

DEFAULT_BACKEND = os.getenv("BACKEND_URL", "https://api.luminostech.tech")


def banner(title: str) -> None:
    print()
    print("=" * 72)
    print(f"  {title}")
    print("=" * 72)


def report(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    line = f"  [{status}] {name}"
    if detail:
        line += f"\n         {detail}"
    print(line)


def test_health(backend: str) -> bool:
    banner("1) GET /health")
    try:
        r = requests.get(f"{backend}/health", timeout=10)
        print(f"  HTTP {r.status_code}  body={r.text[:200]!r}")
        ok = r.status_code == 200
        report("Backend đang sống", ok,
               "" if ok else f"HTTP {r.status_code} — service có thể down hoặc reverse-proxy lỗi")
        return ok
    except requests.RequestException as e:
        report("Backend đang sống", False, f"Exception: {e}")
        return False


def test_login_bad_creds(backend: str) -> str:
    """Login với email chắc chắn không tồn tại. Nếu trả 401 → auth code OK.
       Nếu trả 500 → bug nằm trong authenticate_user/create_session (thường do bcrypt)."""
    banner("2) POST /auth/login với email KHÔNG tồn tại (kỳ vọng 401)")
    fake_email = f"noexist_{int(time.time())}@test.local"
    try:
        r = requests.post(
            f"{backend}/api/v1/auth/login",
            json={"email": fake_email, "password": "WrongPass123!"},
            timeout=15,
        )
        print(f"  HTTP {r.status_code}  body={r.text[:300]!r}")
        if r.status_code == 401:
            report("Auth code chạy đúng (bcrypt + DB lookup OK)", True,
                   "Trả 401 = biết user không tồn tại → DB + bcrypt hoạt động")
            return "auth_ok"
        if r.status_code == 422:
            report("Validation lỗi (422)", False,
                   "Có thể schema email yêu cầu format khác — xem body")
            return "schema"
        if r.status_code == 500:
            report("Auth code crash (500)", False,
                   "BUG nặng: xem backend log — thường là bcrypt/passlib, "
                   "DB schema, hoặc DB connection")
            return "crash"
        report(f"HTTP {r.status_code} bất thường", False, r.text[:200])
        return "other"
    except requests.RequestException as e:
        report("Request thất bại", False, f"Exception: {e}")
        return "network"


def test_register_then_login(backend: str) -> bool:
    """Tạo user ngẫu nhiên, login lại. Nếu OK → DB users hoạt động,
       vấn đề chỉ còn là admin user không tồn tại / password sai."""
    banner("3) Đăng ký user ngẫu nhiên + đăng nhập lại")
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    email = f"diag_{suffix}@test.local"
    password = "DiagPass123!"
    full_name = "Diag User"

    print(f"  email={email}")
    try:
        r = requests.post(
            f"{backend}/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": full_name},
            timeout=15,
        )
        print(f"  register HTTP {r.status_code}  body={r.text[:300]!r}")
        if r.status_code not in (200, 201):
            report("Register", False,
                   f"DB có thể chưa có bảng users / unique constraint / email validation. body={r.text[:200]}")
            return False

        r = requests.post(
            f"{backend}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        print(f"  login    HTTP {r.status_code}  body={r.text[:200]!r}")
        if r.status_code != 200:
            report("Login user mới", False,
                   "Register OK nhưng login fail → bug trong create_session / log_action / JWT")
            return False
        body = r.json()
        if not body.get("access_token"):
            report("Login user mới", False, f"Không có access_token: {body}")
            return False
        report("DB + auth + JWT hoạt động với user mới", True,
               f"access_token len={len(body['access_token'])}")
        return True
    except requests.RequestException as e:
        report("Request thất bại", False, f"Exception: {e}")
        return False


def test_admin_login(backend: str, email: str, password: str) -> bool:
    banner(f"4) POST /auth/login với admin thật: {email}")
    try:
        r = requests.post(
            f"{backend}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        print(f"  HTTP {r.status_code}  body={r.text[:400]!r}")
        if r.status_code == 200:
            report("Admin login thành công", True)
            return True
        if r.status_code == 401:
            report("Admin login fail (401)", False,
                   "User không tồn tại HOẶC password sai. Nếu test 1+2+3 PASS, "
                   "nghĩa là DB prod chưa có admin user — cần seed.")
            return False
        if r.status_code == 500:
            report("Admin login crash (500)", False,
                   "BUG nặng với admin user — có thể do password hash cũ / "
                   "schema khác local. Xem backend log.")
            return False
        report(f"HTTP {r.status_code}", False, r.text[:200])
        return False
    except requests.RequestException as e:
        report("Request thất bại", False, f"Exception: {e}")
        return False


def test_protected_endpoint(backend: str, token: str) -> None:
    """Test 1 endpoint cần token để biết auth chain có hoạt động không."""
    banner("5) GET /auth/me với token (nếu có)")
    if not token:
        report("Bỏ qua", True, "Không có token")
        return
    try:
        r = requests.get(
            f"{backend}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        print(f"  HTTP {r.status_code}  body={r.text[:200]!r}")
        report("/auth/me với Bearer token", r.status_code == 200,
               "" if r.status_code == 200 else "JWT/Depends có vấn đề")
    except requests.RequestException as e:
        report("Request thất bại", False, f"Exception: {e}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--backend", default=DEFAULT_BACKEND)
    p.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "admin@luminostech.tech"))
    p.add_argument("--password", default=os.getenv("ADMIN_PASSWORD", ""))
    args = p.parse_args()

    print(f"\nBackend: {args.backend}")

    if not test_health(args.backend):
        print("\n❌ Backend không phản hồi — dừng ở đây.")
        print("   Kiểm tra: DNS, firewall, nginx/Caddy có proxy /api/v1 chưa,")
        print("   backend container có đang chạy không, port 8000 có mở không.")
        return 2

    bad_creds_result = test_login_bad_creds(args.backend)
    if bad_creds_result == "crash":
        print("\n❌ Auth code crash với email bất kỳ → bug trong handler.")
        print("   Xem backend log: docker logs <backend> hoặc journalctl -u lumo-backend -n 200")
        print("   Khả năng cao: bcrypt 4.x + passlib 1.7.4 mismatch, hoặc DB schema chưa tồn tại.")
        return 3

    user_ok = test_register_then_login(args.backend)

    token = ""
    if args.password:
        if test_admin_login(args.backend, args.email, args.password):
            try:
                r = requests.post(
                    f"{args.backend}/api/v1/auth/login",
                    json={"email": args.email, "password": args.password},
                    timeout=15,
                )
                token = r.json().get("access_token", "")
            except Exception:
                token = ""
    else:
        print("\n  (Bỏ qua test admin — không có --password)")

    if token:
        test_protected_endpoint(args.backend, token)

    banner("KẾT LUẬN")
    if bad_creds_result == "auth_ok" and user_ok and not token:
        print("  • Backend + DB + JWT đều OK")
        print("  • Nhưng admin login fail → admin user không tồn tại / password sai")
        print("  • Fix: SSH lên server, chạy seed admin hoặc cập nhật password trong DB")
    elif not user_ok:
        print("  • Register/Login user mới cũng fail → DB schema / connection issue")
        print("  • Fix: chạy alembic upgrade head hoặc kiểm tra DATABASE_URL trên server")
    elif not token:
        print("  • Cần truyền --password để test admin")
    else:
        print("  • Mọi thứ PASS — script prod đã sẵn sàng")

    return 0


if __name__ == "__main__":
    sys.exit(main())
