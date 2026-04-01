"use client";
import { useEffect } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { format } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Thông báo</h1>
        {notifications.some((n) => !n.is_read) && (
          <button className="btn-secondary text-xs" onClick={markAllRead}>
            <CheckCheck size={14} /> Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Chưa có thông báo nào.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`card p-4 cursor-pointer hover:shadow-md transition-shadow ${!n.is_read ? "border-l-4 border-l-primary-500" : ""}`}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className={`text-sm font-medium ${n.is_read ? "text-gray-600" : "text-gray-900"}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.content}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{format(new Date(n.created_at), "HH:mm dd/MM")}</p>
                  {!n.is_read && <span className="inline-block w-2 h-2 rounded-full bg-primary-500 mt-1 ml-auto" />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
