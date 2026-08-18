"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { getWebSocketBaseUrl } from "@/lib/publicApi";
import { NOTIFICATION_EVENT_VERSION } from "@/lib/version";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import type { Notification as AppNotification } from "@/types";


interface NotificationEvent {
  type: "notification.created";
  version: number;
  data: AppNotification;
}


export default function NotificationRealtime() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

  useEffect(() => {
    if (!isAuthenticated) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let retry = 0;

    const connect = () => {
      const token = localStorage.getItem("access_token");
      if (!token || stopped) return;

      socket = new WebSocket(`${getWebSocketBaseUrl()}/ws/notifications`);
      socket.onopen = () => {
        retry = 0;
        socket?.send(JSON.stringify({ type: "auth", token }));
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        let message: { type?: string; version?: number; data?: AppNotification };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === "ready") {
          void fetchNotifications();
          return;
        }
        if (message.type !== "notification.created" || !message.data) return;
        if (message.version !== NOTIFICATION_EVENT_VERSION) {
          void fetchNotifications();
          return;
        }

        const notificationMessage = message as NotificationEvent;
        const current = useNotificationStore.getState();
        if (current.notifications.some((item) => item.id === notificationMessage.data.id)) return;

        current.receiveNotification(notificationMessage.data);
        toast(notificationMessage.data.title, {
          description: notificationMessage.data.content,
        });
      };

      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        if (stopped) return;
        const delay = Math.min(1000 * 2 ** retry, 10000);
        retry += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      socket?.close();
    };
  }, [fetchNotifications, isAuthenticated]);

  return null;
}
