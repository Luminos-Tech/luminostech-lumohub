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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-100 flex md:hidden safe-area-inset-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 text-[9px] font-semibold transition-all duration-200 relative",
              active
                ? "text-primary-600"
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            {/* Active indicator line */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-primary-500 rounded-full" />
            )}
            <item.icon
              size={19}
              className={cn(
                "transition-all duration-200",
                active ? "stroke-primary-600 scale-110" : "stroke-gray-400"
              )}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
