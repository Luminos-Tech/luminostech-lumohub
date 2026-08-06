"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/authStore";
import BottomNav from "./BottomNav";
import Topbar from "./Topbar";
import { OPEN_AUTH_EVENT, OPEN_NOTIFICATIONS_EVENT } from "@/lib/uiEvents";

const AuthModal = dynamic(() => import("@/components/auth/AuthModal"), { ssr: false });
const NotificationModal = dynamic(() => import("@/components/notifications/NotificationModal"), { ssr: false });

const PRELOAD_ROUTES = ["/dashboard", "/calendar", "/settings/event-buttons", "/settings/devices", "/notifications", "/settings"];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, fetchMe } = useAuthStore();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token && !user) fetchMe().catch(() => undefined);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const startPreload = () => PRELOAD_ROUTES.forEach((route, index) => {
      timers.push(setTimeout(() => router.prefetch(route), index * 650));
    });
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idleId = idleWindow.requestIdleCallback?.(startPreload, { timeout: 2500 });
    if (idleId === undefined) timers.push(setTimeout(startPreload, 1800));
    return () => {
      timers.forEach(clearTimeout);
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [fetchMe, router, user]);

  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    const openNotifications = () => setNotificationsOpen(true);
    window.addEventListener(OPEN_AUTH_EVENT, openAuth);
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, openNotifications);
    return () => {
      window.removeEventListener(OPEN_AUTH_EVENT, openAuth);
      window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, openNotifications);
    };
  }, []);

  return (
    <div className="mobile-app-shell">
      <Topbar />
      <main className="mobile-app-content" onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        const href = anchor?.getAttribute("href");
        if (isAuthenticated && href === "/notifications") {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
          return;
        }
        if (isAuthenticated) return;
        if (href && href.startsWith("/") && href !== "/dashboard") {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
        }
      }}>{children}</main>
      <BottomNav />
      {authOpen && <AuthModal onClose={closeAuth} />}
      {notificationsOpen && <NotificationModal onClose={closeNotifications} />}
    </div>
  );
}
