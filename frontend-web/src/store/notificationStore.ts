import { create } from "zustand";
import type { Notification } from "@/types";
import { api } from "@/lib/api";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  receiveNotification: (notification: Notification) => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    const res = await api.get<Notification[]>("/notifications");
    const notifs = res.data;
    set({ notifications: notifs, unreadCount: notifs.filter((n) => !n.is_read).length });
  },

  receiveNotification: (notification) => {
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) {
        return state;
      }
      const notifications = [notification, ...state.notifications].slice(0, 50);
      return {
        notifications,
        unreadCount: notifications.filter((item) => !item.is_read).length,
      };
    });
  },

  markRead: async (id) => {
    await api.patch(`/notifications/${id}/read`);
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      return { notifications: updated, unreadCount: updated.filter((n) => !n.is_read).length };
    });
  },

  markAllRead: async () => {
    await api.patch("/notifications/read-all");
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },
}));
