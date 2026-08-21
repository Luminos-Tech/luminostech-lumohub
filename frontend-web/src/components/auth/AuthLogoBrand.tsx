"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demoStore";

export default function AuthLogoBrand() {
  const router = useRouter();
  const { enableDemoMode, setDrawerOpen } = useDemoStore();
  const clickCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = (e: React.MouseEvent) => {
    clickCountRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (clickCountRef.current >= 3) {
      e.preventDefault();
      clickCountRef.current = 0;
      enableDemoMode();
      setDrawerOpen(true);
      toast.success("✨ Đã kích hoạt chế độ Demo LUMO!");
      router.push("/dashboard");
      return;
    }

    timerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1200);
  };

  return (
    <Link href="/" className="auth-brand" aria-label="Lumo - Trang chủ" onClick={handleLogoClick}>
      <span className="auth-brand-mark">
        <Image src="/logo-luminostech.png" alt="LuminosTech" width={47} height={62} priority />
      </span>
      <span><strong>LUMO</strong><small>by LuminosTech</small></span>
    </Link>
  );
}
