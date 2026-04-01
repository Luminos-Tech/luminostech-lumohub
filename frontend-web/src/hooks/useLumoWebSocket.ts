"use client";
import { useEffect, useRef, useCallback } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { getWebSocketBaseUrl } from "@/lib/publicApi";

export function useLumoWebSocket(userId: number | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const { fetchNotifications } = useNotificationStore();

  const connect = useCallback(() => {
    if (!userId) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const wsUrl = getWebSocketBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/lumo/${userId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔌 LUMO WebSocket connected");
      // Keepalive ping every 30s
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30000);
      ws.onclose = () => clearInterval(interval);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "reminder") {
          // Re-fetch notifications so the bell updates
          fetchNotifications();
          // Optional: browser notification
          if (Notification.permission === "granted") {
            new Notification(`⏰ ${data.title}`, { body: data.message });
          }
        }
      } catch {}
    };

    ws.onerror = () => console.warn("LUMO WS error");
    ws.onclose = () => {
      console.log("❌ LUMO WS closed — reconnecting in 5s");
      setTimeout(connect, 5000);
    };
  }, [userId, fetchNotifications]);

  useEffect(() => {
    connect();
    // Request browser notification permission
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => wsRef.current?.close();
  }, [connect]);
}
