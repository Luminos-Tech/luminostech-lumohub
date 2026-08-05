"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";

export default function Topbar() {
  const { user } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <header className="mobile-topbar">
      <Link href="/dashboard" className="brand-lockup" aria-label="Lumo - Trang chủ">
        <Image src="/logo-luminostech.png" alt="LuminosTech" width={600} height={800} priority unoptimized />
        <span><strong>LUMO</strong><small>by LuminosTech</small></span>
      </Link>
      <div className="topbar-actions">
        <Link href="/notifications" className="icon-button" aria-label="Thông báo">
          <Bell size={20} />
          {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </Link>
        <Link href="/settings" className="user-avatar" aria-label="Tài khoản">
          {user?.avatar_url ? <Image src={user.avatar_url} alt="" fill /> : (user?.full_name?.trim().charAt(0) || "L")}
        </Link>
      </div>
    </header>
  );
}
