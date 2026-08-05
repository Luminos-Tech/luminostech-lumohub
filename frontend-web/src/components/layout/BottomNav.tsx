"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, HeartPulse, Home, Settings, Watch } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/settings/event-buttons", label: "Điểm danh", icon: HeartPulse },
  { href: "/calendar", label: "Lịch", icon: CalendarDays },
  { href: "/settings/devices", label: "Thiết bị", icon: Watch },
  { href: "/settings", label: "Tài khoản", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav" aria-label="Điều hướng chính">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link key={item.href} href={item.href} className={cn("bottom-nav-item", active && "active")}>
            <span><item.icon size={21} strokeWidth={active ? 2.5 : 2} /></span>
            <small>{item.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
