"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, UserRound } from "lucide-react";
import { OPEN_AUTH_EVENT, OPEN_NOTIFICATIONS_EVENT } from "@/lib/uiEvents";
import { registerLogoTap, openSecretDemoConsole } from "@/lib/demoTrigger";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore } from "@/store/demoStore";

export default function Topbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { unreadCount: storeUnreadCount, notifications, fetchNotifications } = useNotificationStore();
  const { isDemoMode, mockUser, mockNotifications } = useDemoStore();
  const language = usePreferenceStore((state) => state.language);

  const unreadCount = isDemoMode && notifications.length === 0
    ? mockNotifications.filter((n) => !n.is_read).length
    : storeUnreadCount;

  const text = language === "vi"
    ? { home: "Lumo - Trang chủ", notifications: "Thông báo", notificationsGuest: "Đăng nhập để xem thông báo", account: "Tài khoản", auth: "Đăng nhập hoặc đăng ký" }
    : { home: "Lumo - Home", notifications: "Notifications", notificationsGuest: "Sign in to view notifications", account: "Account", auth: "Sign in or create account" };
  
  useEffect(() => { if (isAuthenticated) fetchNotifications(); }, [fetchNotifications, isAuthenticated]);

  const activeUser = isAuthenticated ? user : isDemoMode ? mockUser : null;

  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="brand-lockup cursor-pointer select-none active:opacity-80 transition-opacity bg-transparent border-0 p-0 text-left" 
        aria-label={text.home} 
        onDoubleClick={(e) => openSecretDemoConsole(e)}
        onClick={(e) => registerLogoTap(e)}
      >
        <Image src="/logo-luminostech.png" alt="LuminosTech" width={40} height={40} sizes="40px" priority />
        <span><strong>LUMO</strong><small>by LuminosTech</small></span>
      </button>
      <div className="topbar-actions">
        {isAuthenticated || isDemoMode ? (
          <button type="button" className="icon-button" aria-label={text.notifications} onClick={() => window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT))}>
            <Bell size={20} />
            {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
        ) : (
          <button type="button" className="icon-button" aria-label={text.notificationsGuest} onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT))}><Bell size={20} /></button>
        )}
        {activeUser ? (
          <Link href="/settings" className="user-avatar" aria-label={text.account} title={activeUser.full_name}>
            {activeUser.avatar_url ? <Image src={activeUser.avatar_url} alt="" fill /> : (activeUser.full_name?.trim().charAt(0) || "M")}
          </Link>
        ) : (
          <button className="user-avatar guest" type="button" aria-label={text.auth} onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT))}>
            <UserRound size={21} />
          </button>
        )}
      </div>
    </header>
  );
}

