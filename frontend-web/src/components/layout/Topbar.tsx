"use client";
import { useNotificationStore } from "@/store/notificationStore";
import { useEffect } from "react";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { unreadCount, fetchNotifications } = useNotificationStore();

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <header className="h-12 sm:h-13 border-b border-gray-100 bg-white/90 backdrop-blur-lg flex items-center justify-between px-3 sm:px-6 gap-3 sticky top-0 z-30">
      {/* Mobile hamburger — hidden on desktop */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all md:hidden -ml-1"
        aria-label="Mở menu"
      >
        <Menu size={20} />
      </button>

      {/* LumoHub brand — show on mobile only (desktop has sidebar) */}
      <Link href="/dashboard" className="flex items-center gap-1.5 md:hidden">
        <Image
          src="/logo_lumohub.png"
          alt="LumoHub Logo"
          width={120}
          height={42}
          unoptimized
          className="object-contain w-auto h-6"
        />
      </Link>

      {/* Spacer so bell is pushed right on desktop */}
      <div className="hidden md:flex flex-1" />

      <Link
        href="/notifications"
        className="relative p-2 hover:bg-primary-50 rounded-xl text-gray-400 hover:text-primary-600 transition-all"
        aria-label="Thông báo"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
