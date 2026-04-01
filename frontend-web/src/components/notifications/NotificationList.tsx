"use client";
import { useNotificationStore } from "@/store/notificationStore";
import NotificationItem from "./NotificationItem";
import { Bell } from "lucide-react";

export default function NotificationList() {
  const { notifications, markRead } = useNotificationStore();

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Bell size={32} className="text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">Không có thông báo</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onClick={() => !n.is_read && markRead(n.id)}
        />
      ))}
    </ul>
  );
}
