"use client";
/**
 * ServiceWorkerRegistration
 * Client component dùng để đăng ký PWA Service Worker
 * Chỉ chạy ở browser (useEffect), không ảnh hưởng SSR
 * Đồng thời khởi tạo Web Push Notification (nếu được hỗ trợ)
 */
import { useEffect } from "react";
import { initPushNotifications, isPushSupported, getNotificationPermission } from "@/lib/push-notification";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[PWA] Service Worker registered:", registration.scope);

        // 初始化 Web Push 通知（仅在 HTTPS 或 localhost）
        const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";
        if (isSecure && isPushSupported()) {
          const permission = getNotificationPermission();
          if (permission === "default") {
            // 静默初始化，等用户主动开启通知
            console.log("[PWA] Push notification: awaiting user permission");
          } else if (permission === "granted") {
            const result = await initPushNotifications();
            if (result.success) {
              console.log("[PWA] Push notifications enabled");
            }
          }
        }
      } catch (error) {
        console.warn("[PWA] Service Worker registration failed:", error);
      }
    });
  }, []);

  // Không render gì cả - chỉ đăng ký SW
  return null;
}
