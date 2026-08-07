"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPEN_AUTH_EVENT, OPEN_NOTIFICATIONS_EVENT } from "@/lib/uiEvents";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { navItems } from "./BottomNav";

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const language = usePreferenceStore((state) => state.language);
  const text = language === "en"
    ? { navigation: "Main navigation", notifications: "Notifications", account: "Account", signIn: "Sign in or create account", guest: "Guest account" }
    : { navigation: "Điều hướng chính", notifications: "Thông báo", account: "Tài khoản", signIn: "Đăng nhập hoặc đăng ký", guest: "Tài khoản khách" };

  const guard = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isAuthenticated || href === "/dashboard") return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
  };

  return (
    <aside className="desktop-sidebar">
      <Link href="/dashboard" className="desktop-sidebar-brand" aria-label="Lumo Home">
        <Image src="/logo-luminostech.png" alt="LuminosTech" width={46} height={46} sizes="46px" priority />
        <span><strong>LUMO</strong><small>by LuminosTech</small></span>
      </Link>

      <nav className="desktop-sidebar-nav" aria-label={text.navigation}>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          return (
            <Link className={cn("desktop-nav-item", active && "active")} href={item.href} key={item.href} title={item[language]} onClick={(event) => guard(event, item.href)}>
              <span><item.icon size={item.kind === "home" ? 29 : item.kind === "devices" ? 30 : 25} strokeWidth={active ? 2.3 : 2} /></span>
              <strong>{item[language]}</strong>
            </Link>
          );
        })}

        <button type="button" className="desktop-nav-item" title={text.notifications} aria-label={text.notifications} onClick={() => window.dispatchEvent(new CustomEvent(isAuthenticated ? OPEN_NOTIFICATIONS_EVENT : OPEN_AUTH_EVENT))}>
          <span><Bell size={25} strokeWidth={2} />{unreadCount > 0 && <i>{unreadCount > 9 ? "9+" : unreadCount}</i>}</span>
          <strong>{text.notifications}</strong>
        </button>
      </nav>

      {isAuthenticated ? (
        <Link href="/settings" className={cn("desktop-account", pathname === "/settings" && "active")}>
          <span className="desktop-account-avatar">{user?.avatar_url ? <Image src={user.avatar_url} alt="" fill sizes="42px" /> : (user?.full_name?.trim().charAt(0) || "L")}</span>
          <span><strong>{user?.full_name || text.account}</strong><small>{text.account}</small></span>
        </Link>
      ) : (
        <button type="button" className="desktop-account" title={text.signIn} onClick={() => window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT))}>
          <span className="desktop-account-avatar guest"><UserRound size={22} /></span>
          <span><strong>{text.signIn}</strong><small>{text.guest}</small></span>
        </button>
      )}
    </aside>
  );
}
