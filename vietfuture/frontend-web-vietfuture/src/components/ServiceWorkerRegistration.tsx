"use client";
/**
 * ServiceWorkerRegistration
 * Client component dùng để đăng ký PWA Service Worker
 * Chỉ chạy ở browser (useEffect), không ảnh hưởng SSR
 * Đồng thời khởi tạo Web Push Notification (nếu được hỗ trợ)
 */
import { useEffect } from "react";
import { initPushNotifications, isPushSupported, getNotificationPermission } from "@/lib/push-notification";
import { useAuthStore } from "@/store/authStore";

export function ServiceWorkerRegistration() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const setupServiceWorker = async () => {
      // A development service worker can keep serving an old Next.js bundle.
      // Remove it and its caches so UI changes are visible immediately.
      if (process.env.NODE_ENV !== "production") {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
        return;
      }

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
          } else if (permission === "granted" && isAuthenticated) {
            const result = await initPushNotifications();
            if (result.success) {
              console.log("[PWA] Push notifications enabled");
            }
          }
        }
      } catch (error) {
        console.warn("[PWA] Service Worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void setupServiceWorker();
    } else {
      window.addEventListener("load", setupServiceWorker, { once: true });
    }

    return () => window.removeEventListener("load", setupServiceWorker);
  }, [isAuthenticated]);

  // Không render gì cả - chỉ đăng ký SW
  return null;
}
