"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore } from "@/demo/store";
import { format } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotificationStore();
  const { isDemoMode, mockNotifications } = useDemoStore();
  const isEnglish = usePreferenceStore((state) => state.language === "en");

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const effectiveList = notifications.length > 0 ? notifications : (isDemoMode ? mockNotifications : []);

  const text = isEnglish ? {
    title: "Notifications",
    markAll: "Mark all as read",
    empty: "No notifications yet.",
  } : {
    title: "Thông báo",
    markAll: "Đánh dấu tất cả đã đọc",
    empty: "Chưa có thông báo nào.",
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell size={22} className="text-teal-600 dark:text-teal-400" />
          {text.title}
        </h1>
        {effectiveList.some((n) => !n.is_read) && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition-colors cursor-pointer"
            onClick={markAllRead}
          >
            <CheckCheck size={15} /> {text.markAll}
          </button>
        )}
      </div>

      {effectiveList.length === 0 ? (
        <div className="bg-white dark:bg-slate-850 border border-gray-100 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <Bell size={40} className="text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">{text.empty}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {effectiveList.map((n) => (
            <li
              key={n.id}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                !n.is_read
                  ? "bg-white dark:bg-slate-850 border-teal-500/50 shadow-md shadow-teal-950/5 border-l-4 border-l-teal-500"
                  : "bg-white/80 dark:bg-slate-900 border-gray-100 dark:border-slate-800/80 opacity-80 hover:opacity-100"
              }`}
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${n.is_read ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-white"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {n.content}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-mono text-gray-400 dark:text-slate-500">
                    {format(new Date(n.created_at), "HH:mm · dd/MM")}
                  </p>
                  {!n.is_read && (
                    <span className="inline-block w-2 h-2 rounded-full bg-teal-500 mt-1.5 ml-auto animate-pulse" />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
