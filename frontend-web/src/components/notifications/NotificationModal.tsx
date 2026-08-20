"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore } from "@/store/demoStore";
import type { Notification } from "@/types";

export default function NotificationModal({ onClose }: { onClose: () => void }) {
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotificationStore();
  const { isDemoMode, mockNotifications } = useDemoStore();
  const language = usePreferenceStore((state) => state.language);
  const text = language === "vi"
    ? { title: "Thông báo", allRead: "Đọc tất cả", empty: "Chưa có thông báo nào", hint: "Các cập nhật quan trọng từ Lumo sẽ xuất hiện tại đây." }
    : { title: "Notifications", allRead: "Mark all read", empty: "No notifications yet", hint: "Important updates from Lumo will appear here." };

  useEffect(() => {
    void fetchNotifications();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [fetchNotifications, onClose]);

  const effectiveList: Notification[] = notifications.length > 0 ? notifications : (isDemoMode ? mockNotifications : []);

  return (
    <div className="notification-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="notification-modal" role="dialog" aria-label={text.title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="notification-modal-heading">
          <div><span><Bell size={19} /></span><div><h2>{text.title}</h2><small>{effectiveList.length}</small></div></div>
          {effectiveList.some((item) => !item.is_read) && <button type="button" onClick={() => void markAllRead()}><CheckCheck size={16} />{text.allRead}</button>}
        </header>

        {effectiveList.length === 0 ? (
          <div className="notification-empty"><span><Bell size={25} /></span><strong>{text.empty}</strong><small>{text.hint}</small></div>
        ) : (
          <div className="notification-modal-list">
            {effectiveList.map((item) => (
              <button type="button" className={`notification-modal-item ${item.is_read ? "" : "unread"}`} key={item.id} onClick={() => !item.is_read && void markRead(item.id)}>
                <span className="notification-status" />
                <span><strong>{item.title}</strong><small>{item.content}</small></span>
                <time>{format(new Date(item.created_at), "HH:mm · dd/MM")}</time>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

