import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Lumo">
        <Link href="/" className="auth-brand" aria-label="Lumo - Trang chủ">
          <span className="auth-brand-mark">
            <Image src="/logo-luminostech.png" alt="" width={47} height={62} priority />
          </span>
          <span><strong>Lumo</strong><small>by LuminosTech</small></span>
        </Link>

        <div className="auth-intro">
          <span className="auth-trust"><ShieldCheck size={15} /> An tâm mỗi ngày</span>
          <h1>Luôn gần bên,<br />dù ở xa.</h1>
          <p>Theo dõi điểm danh, lịch nhắc và thiết bị của người thân trong một nơi riêng tư, dễ sử dụng.</p>
        </div>

        <div className="auth-form-card">{children}</div>

        <p className="auth-footer">© 2026 LuminosTech · Dữ liệu của gia đình luôn được bảo vệ</p>
      </section>
      <aside className="auth-story" aria-hidden="true">
        <div className="auth-story-copy">
          <span>Một nhịp chạm nhỏ</span>
          <strong>Một tín hiệu<br />bình an.</strong>
        </div>
        <div className="auth-rings"><i /><i /><i /></div>
      </aside>
    </main>
  );
}
