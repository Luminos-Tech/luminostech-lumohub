"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Calendar, ListChecks, Bell, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",     label: "Tổng quan",  icon: LayoutDashboard },
  { href: "/calendar",      label: "Lịch",        icon: Calendar },
  { href: "/events",        label: "Sự kiện",     icon: ListChecks },
  { href: "/notifications", label: "Thông báo",   icon: Bell },
  { href: "/settings",      label: "Cài đặt",     icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex md:hidden safe-area-inset-bottom">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors",
              active
                ? "text-primary-600"
                : "text-gray-400 hover:text-gray-700"
            )}
          >
            <item.icon
              size={21}
              className={cn(active ? "stroke-primary-600" : "stroke-gray-400")}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
