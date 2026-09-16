"use client";
import { useNotificationStore } from "@/store/notificationStore";
import { Bell } from "lucide-react";
import Link from "next/link";

export default function NotificationBell() {
  const { unreadCount } = useNotificationStore();
  return (
    <Link href="/notifications" className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
