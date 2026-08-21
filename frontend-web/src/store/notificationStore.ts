import { create } from "zustand";
import type { Notification } from "@/types";
import { api } from "@/lib/api";
import { useDemoStore } from "./demoStore";

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
    try {
      const res = await api.get<Notification[]>("/notifications");
      const notifs = res.data;
      set({ notifications: notifs, unreadCount: notifs.filter((n) => !n.is_read).length });
    } catch (error) {
      const demoState = useDemoStore.getState();
      if (demoState?.mockNotifications) {
        const unread = demoState.mockNotifications.filter((n) => !n.is_read).length;
        set((s) => ({ ...s, unreadCount: unread }));
      }
    }
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
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n));
      return { notifications: updated, unreadCount: updated.filter((n) => !n.is_read).length };
    });
    useDemoStore.getState().markMockNotificationRead?.(id);

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Offline / demo mode fallback
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    useDemoStore.getState().markAllMockNotificationsRead?.();

    try {
      await api.patch("/notifications/read-all");
    } catch {
      // Offline / demo mode fallback
    }
  },
}));
