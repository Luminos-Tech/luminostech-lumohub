"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { OPEN_AUTH_EVENT } from "@/lib/uiEvents";
import { usePreferenceStore } from "@/store/preferenceStore";
import { LumoHubIcon } from "@/components/icons/LumoDeviceIcons";

export const navItems = [
  { href: "/dashboard", vi: "Trang chủ", en: "Home", icon: LumoHomeIcon, kind: "home" },
  { href: "/settings/event-buttons", vi: "Lời nhắn", en: "Voices", icon: AudioLines },
  { href: "/calendar", vi: "Lịch", en: "Calendar", icon: CalendarDays },
  { href: "/settings/devices", vi: "Thiết bị", en: "Devices", icon: LumoHubIcon, kind: "devices" },
];

export function LumoHomeIcon({ size = 32 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const language = usePreferenceStore((state) => state.language);
  return (
    <nav className="mobile-bottom-nav" aria-label={language === "en" ? "Main navigation" : "Điều hướng chính"}>
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link key={item.href} href={item.href} aria-label={item[language]} title={item[language]} className={cn("bottom-nav-item", active && "active")} onClick={(event) => {
            if (!isAuthenticated && item.href !== "/dashboard") {
              event.preventDefault();
              window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
            }
          }}>
            <span className={cn("dock-icon", item.kind && `dock-icon-${item.kind}`)}>
              <item.icon size={item.kind === "home" ? 32 : item.kind === "devices" ? 33 : 27} strokeWidth={active ? 2.35 : 2.05} />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
