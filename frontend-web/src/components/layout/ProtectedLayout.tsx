"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/authStore";
import { useDemoStore } from "@/demo/store";
import BottomNav from "./BottomNav";
import DesktopSidebar from "./DesktopSidebar";
import Topbar from "./Topbar";
import { OPEN_AUTH_EVENT, OPEN_DEMO_DRAWER_EVENT, OPEN_NOTIFICATIONS_EVENT } from "@/lib/uiEvents";
import { DEMO_SYNC_CHANNEL_NAME, DemoSyncPayload } from "@/demo/sync";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { toast } from "sonner";
import { CheckCircle2, Pill, BatteryCharging, Wifi, BellRing } from "lucide-react";

const AuthModal = dynamic(() => import("@/components/auth/AuthModal"), { ssr: false });
const NotificationModal = dynamic(() => import("@/components/notifications/NotificationModal"), { ssr: false });
const DemoControlDrawer = dynamic(() => import("@/demo/components/DemoControlDrawer"), { ssr: false });
const DemoFallAlertModal = dynamic(() => import("@/demo/components/DemoFallAlertModal"), { ssr: false });
const DemoMedicationModal = dynamic(() => import("@/demo/components/DemoMedicationModal"), { ssr: false });
const DemoVoiceCompanionModal = dynamic(() => import("@/demo/components/DemoVoiceCompanionModal"), { ssr: false });

const PRELOAD_ROUTES = ["/dashboard", "/calendar", "/settings/event-buttons", "/settings/devices", "/notifications", "/settings"];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe, logout } = useAuthStore();
  const { isDemoMode, toggleDrawer } = useDemoStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isStealthMode = searchParams.get("stealth") === "true";
  const [authOpen, setAuthOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) fetchMe().catch(() => undefined);
    else if (isAuthenticated) void logout();

    PRELOAD_ROUTES.forEach((route) => {
      router.prefetch(route);
    });
  }, [fetchMe, isAuthenticated, logout, router]);

  useEffect(() => {
    const openAuth = () => setAuthOpen(true);
    const openNotifications = () => setNotificationsOpen(true);
    const openDemoDrawer = () => {
      useDemoStore.getState().setDrawerOpen(true);
    };

    window.addEventListener(OPEN_AUTH_EVENT, openAuth);
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, openNotifications);
    window.addEventListener(OPEN_DEMO_DRAWER_EVENT, openDemoDrawer);

    return () => {
      window.removeEventListener(OPEN_AUTH_EVENT, openAuth);
      window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, openNotifications);
      window.removeEventListener(OPEN_DEMO_DRAWER_EVENT, openDemoDrawer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.BroadcastChannel) return;
    
    const bc = new BroadcastChannel(DEMO_SYNC_CHANNEL_NAME);
    bc.onmessage = (event: MessageEvent<DemoSyncPayload>) => {
      if (typeof window !== "undefined") (window as any).__LUMO_IS_SYNCING = true;
      try {
        const payload = event.data;
        const demoStore = useDemoStore.getState();
        
        switch (payload.type) {
          case "TRIGGER_FALL":
            demoStore.triggerFallDetection();
            break;
        case "DISMISS_FALL":
          demoStore.dismissFallAlert();
          break;
        case "TRIGGER_MEDICATION":
          demoStore.triggerMedicationReminder();
          break;
        case "TRIGGER_VOICE":
          demoStore.triggerVoiceCompanion();
          break;
        case "TRIGGER_CHECKIN":
          demoStore.triggerCheckIn();
          break;
        case "SET_BATTERY":
          demoStore.setBatteryLevel(payload.value);
          break;
        case "SET_STEPS":
          demoStore.setStepsToday(payload.value);
          break;
        case "SET_ACTIVITY":
          demoStore.setActivityMinutes(payload.value);
          break;
        case "SET_NETWORK":
          demoStore.setNetworkStatus(payload.value);
          break;
        case "SET_DEMO_MODE":
          if (payload.value) demoStore.enableDemoMode();
          else demoStore.disableDemoMode();
          break;
        case "SET_HUB_ONLINE":
          demoStore.setHubOnline(payload.value);
          break;
        case "SET_BAND_CONNECTED":
          demoStore.setBandConnected(payload.value);
          break;
        case "SET_FAMILY_PRESET":
          demoStore.setFamilyPreset(payload.value);
          break;
        case "SET_DEMO_TARGET_PROFILE_ID":
          demoStore.setDemoTargetProfileId(payload.value);
          break;
        case "UPDATE_PERSON_PROFILE":
          demoStore.updatePersonProfile(payload.id, payload.updates);
          break;
        case "SET_MOCK_PROFILE_META":
          demoStore.setMockProfileMeta(payload.meta);
          break;
        case "SET_MOCK_CHECKIN_DAYS":
          demoStore.setMockCheckInDays(payload.value);
          break;
        case "SET_MOCK_USER":
          demoStore.setMockUser(payload.updates);
          break;
        case "SET_FALL_DETECTED":
          demoStore.setFallDetected(payload.value);
          break;
        case "SET_ACTIVE_DASHBOARD_PROFILE_ID":
          demoStore.setActiveDashboardProfileId(payload.value);
          break;
        case "CLOSE_SCENARIO_MODAL":
          demoStore.closeScenarioModal();
          break;
        case "MARK_MOCK_NOTIF_READ":
          demoStore.markMockNotificationRead(payload.id);
          break;
        case "MARK_ALL_MOCK_NOTIFS_READ":
          demoStore.markAllMockNotificationsRead();
          break;
        case "RESET_TO_DEFAULT":
          demoStore.resetToDefault();
          break;
        case "CUSTOM_PUSH":
          useNotificationStore.getState().receiveNotification({
            id: Date.now(),
            user_id: 999,
            title: payload.title,
            content: payload.body,
            channel: payload.channel || "lumo",
            is_read: false,
            created_at: new Date().toISOString(),
          });
          
          // Show the banner on main screen
          const isCurrentEnglish = usePreferenceStore.getState().language === "en";
          const iconType = payload.iconType || "bell";
          toast.custom((t) => (
            <div 
              className="bg-white/95 dark:bg-[#0f1d2a]/95 backdrop-blur-md border border-slate-200/90 dark:border-sky-500/40 rounded-2xl p-3.5 sm:p-4 flex gap-3.5 items-center shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-sky-950/40 w-full cursor-pointer hover:bg-slate-50 dark:hover:bg-[#132637] transition-all group"
              onClick={() => {
                toast.dismiss(t);
                window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
              }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                iconType === "check"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-400/30 dark:text-emerald-400"
                  : iconType === "med"
                    ? "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:border-amber-400/30 dark:text-amber-400"
                    : iconType === "battery"
                      ? "bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-500/20 dark:border-orange-400/30 dark:text-orange-400"
                      : iconType === "wifi"
                        ? "bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-500/20 dark:border-cyan-400/30 dark:text-cyan-400"
                        : "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/20 dark:border-sky-400/30 dark:text-sky-400"
              }`}>
                {iconType === "check" ? <CheckCircle2 size={20} /> : iconType === "med" ? <Pill size={20} /> : iconType === "battery" ? <BatteryCharging size={20} /> : iconType === "wifi" ? <Wifi size={20} /> : <BellRing size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 dark:text-sky-400">LUMO Push Alert</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                    {new Date().toLocaleTimeString(isCurrentEnglish ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">{payload.title}</h4>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-tight line-clamp-2 mt-0.5">{payload.body}</p>
              </div>
            </div>
          ), { duration: 5000, unstyled: true, className: "!bg-transparent !border-none !shadow-none !p-0" });

          // Play push chime if available
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const now = ctx.currentTime;
              const osc1 = ctx.createOscillator();
              const gain1 = ctx.createGain();
              osc1.type = "sine";
              osc1.frequency.setValueAtTime(587.33, now);
              gain1.gain.setValueAtTime(0.12, now);
              gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
              osc1.connect(gain1);
              gain1.connect(ctx.destination);
              osc1.start(now);
              osc1.stop(now + 0.25);
            }
          } catch (err) {}
          break;
      }
    } finally {
      if (typeof window !== "undefined") (window as any).__LUMO_IS_SYNCING = false;
    }
  };

  return () => bc.close();
  }, []);

  return (
    <div className="mobile-app-shell">
      <DesktopSidebar />
      <div className="desktop-app-main">
        <Topbar />
        <main className="mobile-app-content" onClickCapture={(event) => {
          const anchor = (event.target as HTMLElement).closest("a");
          const href = anchor?.getAttribute("href");
          if ((isAuthenticated || isDemoMode) && href === "/notifications") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
            return;
          }
          if (isAuthenticated || isDemoMode) return;
          if (href && href.startsWith("/") && href !== "/dashboard") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
          }
        }}>{children}</main>
        <BottomNav />
      </div>

      {authOpen && <AuthModal onClose={closeAuth} />}
      {notificationsOpen && <NotificationModal onClose={closeNotifications} />}

      {/* Demo Suite: Presenter floating drawer & scenario modals */}
      {!isStealthMode && <DemoControlDrawer />}
      <DemoFallAlertModal />
      <DemoMedicationModal />
      <DemoVoiceCompanionModal />
    </div>
  );
}

