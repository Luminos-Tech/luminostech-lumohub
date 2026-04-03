"use client";
import { useNotificationStore } from "@/store/notificationStore";
import { useEffect } from "react";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { unreadCount, fetchNotifications } = useNotificationStore();

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 gap-4 sticky top-0 z-30">
      {/* Mobile hamburger — hidden on desktop */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors md:hidden"
        aria-label="Mở menu"
      >
        <Menu size={22} />
      </button>

      {/* LumoHub brand — show on mobile only (desktop has sidebar) */}
      <span className="font-bold text-gray-900 text-base md:hidden">LumoHub</span>

      {/* Spacer so bell is pushed right on desktop */}
      <div className="hidden md:flex flex-1" />

      <Link
        href="/notifications"
        className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
        aria-label="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
