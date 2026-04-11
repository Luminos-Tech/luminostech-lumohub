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
    <header className="h-11 sm:h-12 border-b border-gray-100 bg-white/90 backdrop-blur-md flex items-center justify-between px-3 sm:px-6 gap-3 sticky top-0 z-30">
      {/* Mobile hamburger — hidden on desktop */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors md:hidden -ml-1"
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
          className="object-contain w-auto h-6"
        />
      </Link>

      {/* Spacer so bell is pushed right on desktop */}
      <div className="hidden md:flex flex-1" />

      <Link
        href="/notifications"
        className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
        aria-label="Thông báo"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
