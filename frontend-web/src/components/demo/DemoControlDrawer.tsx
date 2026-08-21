"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Heart,
  LogOut,
  Mic,
  Pill,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  X,
  Zap,
  Bell,
  BellRing,
  Edit2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useDemoStore, FamilyPreset } from "@/store/demoStore";
import { useNotificationStore } from "@/store/notificationStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useAuthStore } from "@/store/authStore";
import { OPEN_AUTH_EVENT, OPEN_NOTIFICATIONS_EVENT } from "@/lib/uiEvents";

export default function DemoControlDrawer() {
  const isEnglish = usePreferenceStore((state) => state.language === "en");

  const {
    isDemoMode,
    isDrawerOpen,
    activeScenarioModal,
    batteryLevel,
    activityMinutes,
    stepsToday,
    mockCheckInDays,
    fallDetected,
    networkStatus,
    mockUser,
    mockProfileMeta,
    familyPreset,
    mockProfiles,
    demoTargetProfileId,
    enableDemoMode,
    disableDemoMode,
    toggleDemoMode,
    toggleDrawer,
    setDrawerOpen,
    setFamilyPreset,
    setDemoTargetProfileId,
    updatePersonProfile,
    triggerFallDetection,
    triggerCheckIn,
    triggerMedicationReminder,
    triggerVoiceCompanion,
    setBatteryLevel,
    setActivityMinutes,
    setStepsToday,
    setMockCheckInDays,
    setFallDetected,
    setNetworkStatus,
    setMockUser,
    setMockProfileMeta,
    resetToDefault,
  } = useDemoStore();

  const receiveNotification = useNotificationStore((state) => state.receiveNotification);
  const [customPushText, setCustomPushText] = useState("");
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const playPushChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now); // D5
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.25);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now + 0.1); // A5
        gain2.gain.setValueAtTime(0.15, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.45);
      }
    } catch {}
  };

  const triggerPushBanner = (title: string, content: string, channel: string = "system", iconType: "check" | "med" | "battery" | "wifi" | "bell" = "bell") => {
    playPushChime();
    pushMockNotification(title, content, channel);

    toast.custom((t) => (
      <div 
        className="bg-white/95 dark:bg-[#0f1d2a]/95 backdrop-blur-md border border-slate-200/90 dark:border-sky-500/40 rounded-2xl p-3.5 sm:p-4 flex gap-3.5 items-center shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-sky-950/40 max-w-sm w-full cursor-pointer hover:bg-slate-50 dark:hover:bg-[#132637] transition-all group"
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
            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">vừa xong</span>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">{title}</h4>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-tight line-clamp-2 mt-0.5">{content}</p>
        </div>
      </div>
    ));
  };

  const pushMockNotification = (title: string, content: string, channel: string = "system") => {
    receiveNotification({
      id: Date.now() + Math.floor(Math.random() * 1000),
      user_id: mockUser.id || 0,
      title,
      content,
      channel,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  };

  const [activeTab, setActiveTab] = useState<"scenarios" | "family" | "hardware">("scenarios");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("profile_1");

  const bandProfiles = mockProfiles.filter((p) => p.type === "band");
  const currentTargetProfile = bandProfiles.find((p) => p.id === demoTargetProfileId) || bandProfiles[0];
  const activeEditingPerson = bandProfiles.find((p) => p.id === selectedPersonId) || bandProfiles[0] || {
    id: "profile_1",
    name: "Mẹ",
    icon: "👵",
    device_id: "LH-8821",
    batteryLevel: 88,
    activityMinutes: 45,
    checkedInToday: true,
    fallDetected: false,
  };

  // Global Keyboard shortcut: Ctrl+Shift+D or Alt+D to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") || (e.altKey && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        toggleDrawer();
        toast.info(isDrawerOpen ? (isEnglish ? "Demo Panel Closed" : "Đã đóng Demo Panel") : (isEnglish ? "LUMO Demo Panel Opened" : "Đã mở Bảng điều khiển Demo LUMO"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isEnglish, toggleDrawer]);

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Main Floating Presenter Palette */}
      {isDrawerOpen && (
        <aside
          className="fixed bottom-0 sm:bottom-6 right-0 sm:right-4 z-50 w-full sm:w-[440px] max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl shadow-purple-950/90 backdrop-blur-xl text-white flex flex-col animate-in slide-in-from-bottom-5 duration-200"
          role="dialog"
          aria-label="Demo Controller"
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-purple-900/60 via-slate-900 to-indigo-900/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  LUMO Presenter Suite
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Demo
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isEnglish ? "Shortcut:" : "Phím tắt:"} <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">Ctrl+Shift+D</code>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isEnglish ? "Close drawer" : "Đóng panel"}
            >
              <X size={18} />
            </button>
          </div>

          {/* Target Person Selector for Live Scenarios */}
          <div className="px-4 pt-3 pb-1 bg-slate-950/40">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">
              {isEnglish ? "Apply scenario to family member:" : "Kịch bản áp dụng cho người thân:"}
            </label>
            <div className="relative">
              <select
                value={demoTargetProfileId}
                onChange={(e) => {
                  setDemoTargetProfileId(e.target.value);
                  setSelectedPersonId(e.target.value);
                }}
                className="w-full bg-slate-800/90 border border-purple-500/30 rounded-xl py-2 pl-3 pr-8 text-sm text-white appearance-none focus:outline-none focus:border-purple-400 font-semibold cursor-pointer"
              >
                {bandProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name} ({isEnglish ? "Band" : "Vòng"} {p.device_id || "Band"})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Navigation Tabs - Non-wrapping 3-column grid */}
          <div className="grid grid-cols-3 gap-1 border-b border-slate-800 bg-slate-950/60 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("scenarios")}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === "scenarios"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap size={13} className="shrink-0" />
              <span className="truncate">{isEnglish ? "Scenarios" : "Kịch bản"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("family")}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === "family"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users size={13} className="shrink-0" />
              <span className="truncate">{isEnglish ? "Family" : "Người thân"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hardware")}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 truncate ${
                activeTab === "hardware"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Settings2 size={13} className="shrink-0" />
              <span className="truncate">{isEnglish ? "Hub & Net" : "Hub & Mạng"}</span>
            </button>
          </div>

          {/* Tab 1: One-Click Presentation Scenarios */}
          {activeTab === "scenarios" && (
            <div className="p-4 space-y-2.5 overflow-y-auto max-h-[460px]">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isEnglish ? "Trigger event for" : "Kích hoạt sự kiện cho"} <strong className="text-purple-300">{currentTargetProfile?.icon} {currentTargetProfile?.name}</strong>:
              </p>

              {/* 1. Fall Detection SOS */}
              <button
                type="button"
                onClick={() => {
                  triggerFallDetection();
                  const title = isEnglish ? `Fall Alert: ${currentTargetProfile?.name || "Elderly"}` : `Cảnh báo té ngã: ${currentTargetProfile?.name || "Người thân"}`;
                  const msg = isEnglish ? `LUMO Band (${currentTargetProfile?.device_id || "LH-8821"}) detected a hard impact just now!` : `LUMO Band (${currentTargetProfile?.device_id || "LH-8821"}) phát hiện va chạm mạnh lúc vừa xong!`;
                  pushMockNotification(title, msg, "alert");
                  toast.custom((t) => (
                    <div 
                      className="bg-white/95 dark:bg-[#2a1010]/95 backdrop-blur-md border border-red-200 dark:border-red-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-xl shadow-red-950/10 dark:shadow-2xl dark:shadow-red-900/20 max-w-sm w-full cursor-pointer hover:bg-red-50/50 dark:hover:bg-[#381616] transition-colors"
                      onClick={() => {
                        toast.dismiss(t);
                        window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                        <ShieldAlert size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h4>
                        <p className="text-slate-600 dark:text-gray-300 text-xs mt-0.5">{msg}</p>
                      </div>
                    </div>
                  ));
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-500/50 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500/50 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-red-200">{isEnglish ? "1. Simulate Fall (SOS)" : "1. Giả lập Té Ngã (SOS)"}</h5>
                    <p className="text-xs text-slate-400">{isEnglish ? "Full-screen alert + emergency notifications" : "Báo động đỏ toàn màn hình + gửi tin khẩn cấp"}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-red-600/30 text-red-300 font-bold border border-red-500/40">
                  Trigger
                </span>
              </button>

              {/* 2. Touch Reassurance on Band */}
              <button
                type="button"
                onClick={() => {
                  triggerCheckIn();
                  const title = isEnglish ? "Check-in reassurance received" : "Gửi tín hiệu an tâm";
                  const msg = isEnglish ? `${currentTargetProfile?.name || "Elderly"} just tapped the LUMO Band.` : `${currentTargetProfile?.name || "Người thân"} vừa chạm mặt LUMO Band để báo an tâm.`;
                  pushMockNotification(title, msg, "system");
                  toast.custom((t) => (
                    <div 
                      className="bg-white/95 dark:bg-[#102a31]/95 backdrop-blur-md border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-xl shadow-emerald-950/10 dark:shadow-2xl dark:shadow-emerald-900/20 max-w-sm w-full cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-[#133640] transition-colors"
                      onClick={() => {
                        toast.dismiss(t);
                        window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h4>
                        <p className="text-slate-600 dark:text-gray-300 text-xs mt-0.5">{msg}</p>
                      </div>
                    </div>
                  ));
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-emerald-200">{isEnglish ? "2. Touch Check-in on Band" : "2. Chạm xác nhận an tâm"}</h5>
                    <p className="text-xs text-slate-400">{isEnglish ? "Records daily check-in + push status" : "Ghi nhận điểm danh + gửi thông báo an tâm"}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Touch
                </span>
              </button>

              {/* 3. Medication Reminder Modal */}
              <button
                type="button"
                onClick={() => {
                  triggerMedicationReminder();
                  const title = isEnglish ? "Medication reminder" : "Nhắc nhở uống thuốc";
                  const msg = isEnglish ? `LUMO Hub is playing voice reminder for ${currentTargetProfile?.name}.` : `LUMO Hub đang phát giọng nói nhắc ${currentTargetProfile?.name || "Người thân"} uống thuốc.`;
                  pushMockNotification(title, msg, "lumo");
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/40 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Pill size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-amber-200">{isEnglish ? "3. Medication Reminder" : "3. Nhắc nhở uống thuốc"}</h5>
                    <p className="text-xs text-slate-400">{isEnglish ? "Plays voice & shows reminder modal" : "Phát âm thanh & hiển thị modal nhắc lịch thuốc"}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 font-bold border border-amber-500/30">
                  Play
                </span>
              </button>

              {/* 4. Voice Companion Interaction */}
              <button
                type="button"
                onClick={triggerVoiceCompanion}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/40 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mic size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-purple-200">{isEnglish ? "4. LUMO AI Voice Companion" : "4. Trợ lý Trò Chuyện LUMO"}</h5>
                    <p className="text-xs text-slate-400">{isEnglish ? "Interactive 2-way conversation dialogue" : "Hội thoại mẫu 2 chiều với người lớn tuổi"}</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 font-bold border border-purple-500/30">
                  Open
                </span>
              </button>

              {/* 5. Simulate Push Notifications */}
              <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                      <BellRing size={20} className="animate-bounce" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-sky-200">
                        {isEnglish ? "5. Simulate Push Notification" : "5. Giả lập Push Thông Báo"}
                      </h5>
                      <p className="text-xs text-slate-400">
                        {isEnglish ? "Simulates phone banner & unread badge" : "Phát chuông + hiện banner đẩy tức thì"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Push Preset Chips */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const t = isEnglish ? `Check-in received: ${currentTargetProfile?.name}` : `Điểm danh: ${currentTargetProfile?.name}`;
                      const c = isEnglish ? `${currentTargetProfile?.name} confirmed safe at ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.` : `${currentTargetProfile?.name} vừa chạm vòng LUMO Band để báo an tâm.`;
                      triggerPushBanner(t, c, "system", "check");
                    }}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-left text-xs transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="text-emerald-400 font-bold text-sm">✓</span>
                    <div className="min-w-0">
                      <strong className="block text-slate-200 truncate">{isEnglish ? "Check-in ok" : "Đã chạm an tâm"}</strong>
                      <span className="text-[10px] text-slate-400 truncate block">{currentTargetProfile?.name} báo an tâm</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const t = isEnglish ? `Medication time: ${currentTargetProfile?.name}` : `Nhắc uống thuốc: ${currentTargetProfile?.name}`;
                      const c = isEnglish ? `Prescription: 1x Amlodipine 5mg + 1x Glucosamine 500mg.` : `Đến giờ uống 1 viên huyết áp và 1 viên xương khớp nhé!`;
                      triggerPushBanner(t, c, "lumo", "med");
                    }}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-left text-xs transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="text-amber-400 font-bold text-sm">💊</span>
                    <div className="min-w-0">
                      <strong className="block text-slate-200 truncate">{isEnglish ? "Med taken" : "Uống thuốc"}</strong>
                      <span className="text-[10px] text-slate-400 truncate block">1x Amlodipine 5mg</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const t = isEnglish ? `Low battery warning (${currentTargetProfile?.name})` : `Cảnh báo pin yếu (${currentTargetProfile?.name})`;
                      const c = isEnglish ? `LUMO Band (${currentTargetProfile?.device_id || "LH-8821"}) has 15% battery left. Please charge.` : `Vòng đeo tay (${currentTargetProfile?.device_id || "LH-8821"}) còn 15% pin. Vui lòng sạc thiết bị.`;
                      triggerPushBanner(t, c, "alert", "battery");
                    }}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/50 text-left text-xs transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="text-orange-400 font-bold text-sm">🪫</span>
                    <div className="min-w-0">
                      <strong className="block text-slate-200 truncate">{isEnglish ? "Low battery" : "Pin vòng yếu"}</strong>
                      <span className="text-[10px] text-slate-400 truncate block">Còn 15% pin</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const t = isEnglish ? `LUMO Hub online (4G eSIM)` : `LUMO Hub kết nối 4G LTE`;
                      const c = isEnglish ? `LUMO Hub (LB-100) connected via 4G eSIM signal.` : `Thiết bị trung tâm (LB-100) kết nối mạng 4G ổn định 24/7.`;
                      triggerPushBanner(t, c, "system", "wifi");
                    }}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-left text-xs transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="text-cyan-400 font-bold text-sm">📶</span>
                    <div className="min-w-0">
                      <strong className="block text-slate-200 truncate">{isEnglish ? "Hub 4G status" : "LUMO Hub 4G"}</strong>
                      <span className="text-[10px] text-slate-400 truncate block">eSIM LTE sẵn sàng</span>
                    </div>
                  </button>
                </div>

                {/* Custom Push Text Form */}
                <div className="pt-2 border-t border-slate-700/60 flex gap-1.5">
                  <input
                    type="text"
                    value={customPushText}
                    onChange={(e) => setCustomPushText(e.target.value)}
                    placeholder={isEnglish ? "Type custom push notification text..." : "Nhập nội dung push tùy ý..."}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customPushText.trim()) {
                          triggerPushBanner(
                            isEnglish ? "LUMO Alert" : `Thông báo từ ${currentTargetProfile?.name}`,
                            customPushText.trim(),
                            "system",
                            "bell"
                          );
                          setCustomPushText("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPushText.trim()) {
                        triggerPushBanner(
                          isEnglish ? "LUMO Alert" : `Thông báo từ ${currentTargetProfile?.name}`,
                          customPushText.trim(),
                          "system",
                          "bell"
                        );
                        setCustomPushText("");
                      } else {
                        triggerPushBanner(
                          isEnglish ? "LUMO Alert" : `Thông báo an tâm: ${currentTargetProfile?.name}`,
                          isEnglish ? `${currentTargetProfile?.name} is resting safely at home.` : `${currentTargetProfile?.name} đang nghỉ ngơi sinh hoạt bình thường tại nhà.`,
                          "system",
                          "bell"
                        );
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white shrink-0 shadow-md shadow-sky-600/30 active:scale-95 transition-all"
                  >
                    Push
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Custom Family Profiles (1 person / 2 persons: Ba/Mẹ, Ông/Bà) */}
          {activeTab === "family" && (
            <div className="p-4 space-y-3.5 overflow-y-auto max-h-[460px] text-xs">
              {/* Family Preset Chooser */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Users size={16} className="text-purple-400" /> {isEnglish ? "Quick Family Preset:" : "Chọn nhanh cấu hình người thân:"}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFamilyPreset("ba_me");
                      setSelectedPersonId("profile_1");
                      toast.success(isEnglish ? "Switched to: Mother & Father (2 people)" : "Đã chuyển sang cấu hình 2 người: Mẹ & Ba");
                    }}
                    className={`py-2 px-2.5 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                      familyPreset === "ba_me"
                        ? "bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>👵👴</span>
                    <div>
                      <strong className="block text-xs">{isEnglish ? "Mom & Dad" : "Mẹ & Ba"}</strong>
                      <span className="text-[10px] opacity-70">{isEnglish ? "2 people" : "2 người theo dõi"}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFamilyPreset("ong_ba");
                      setSelectedPersonId("profile_1");
                      toast.success(isEnglish ? "Switched to: Grandparents (2 people)" : "Đã chuyển sang cấu hình 2 người: Bà & Ông");
                    }}
                    className={`py-2 px-2.5 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                      familyPreset === "ong_ba"
                        ? "bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>👵👴</span>
                    <div>
                      <strong className="block text-xs">{isEnglish ? "Grandma & Grandpa" : "Bà & Ông"}</strong>
                      <span className="text-[10px] opacity-70">{isEnglish ? "2 people" : "2 người theo dõi"}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFamilyPreset("single_me");
                      setSelectedPersonId("profile_1");
                      toast.success(isEnglish ? "Switched to: Mother only (1 person)" : "Đã chuyển sang cấu hình 1 người: Mẹ");
                    }}
                    className={`py-2 px-2.5 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                      familyPreset === "single_me"
                        ? "bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>👵</span>
                    <div>
                      <strong className="block text-xs">{isEnglish ? "Mom only" : "Chỉ Mẹ"}</strong>
                      <span className="text-[10px] opacity-70">{isEnglish ? "Single elderly" : "1 người đơn thân"}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFamilyPreset("single_ba");
                      setSelectedPersonId("profile_1");
                      toast.success(isEnglish ? "Switched to: Grandma only (1 person)" : "Đã chuyển sang cấu hình 1 người: Bà");
                    }}
                    className={`py-2 px-2.5 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                      familyPreset === "single_ba"
                        ? "bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs"
                        : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>👵</span>
                    <div>
                      <strong className="block text-xs">{isEnglish ? "Grandma only" : "Chỉ Bà"}</strong>
                      <span className="text-[10px] opacity-70">{isEnglish ? "Single elderly" : "1 người đơn thân"}</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Person Switcher Tab */}
              <div className="flex gap-2 border-b border-slate-800 pb-2">
                {bandProfiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPersonId(p.id);
                      setDemoTargetProfileId(p.id);
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      activeEditingPerson.id === p.id
                        ? "bg-teal-600/30 text-teal-200 border-teal-500/50 shadow-md"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name} ({p.device_id})</span>
                  </button>
                ))}
              </div>

              {/* Detailed Realtime Customizer for Selected Person */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <h6 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <span>{activeEditingPerson.icon}</span> {isEnglish ? "Customize info for:" : "Tùy chỉnh thông tin:"} <strong>{activeEditingPerson.name}</strong>
                  </h6>
                  <span className="text-[10px] font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
                    ID {activeEditingPerson.device_id}
                  </span>
                </div>

                {/* Name & Full Name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Display Name:" : "Tên gọi thân mật:"}
                    </label>
                    <input
                      type="text"
                      value={activeEditingPerson.name}
                      onChange={(e) => updatePersonProfile(activeEditingPerson.id, { name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-teal-500 outline-none"
                      placeholder="Mẹ / Ba"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Full Name:" : "Họ và tên đầy đủ:"}
                    </label>
                    <input
                      type="text"
                      value={activeEditingPerson.fullName || ""}
                      onChange={(e) => updatePersonProfile(activeEditingPerson.id, { fullName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-teal-500 outline-none"
                      placeholder="Cụ Nguyễn Thị Mai"
                    />
                  </div>
                </div>

                {/* Address & Age */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Home Address:" : "Địa chỉ nơi ở hiện tại:"}
                    </label>
                    <input
                      type="text"
                      value={activeEditingPerson.address || ""}
                      onChange={(e) => updatePersonProfile(activeEditingPerson.id, { address: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-teal-500 outline-none"
                      placeholder="Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        {isEnglish ? "Age / Birth year:" : "Tuổi / Năm sinh:"}
                      </label>
                      <input
                        type="text"
                        value={activeEditingPerson.age || ""}
                        onChange={(e) => updatePersonProfile(activeEditingPerson.id, { age: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-teal-500 outline-none"
                        placeholder="76 tuổi (1948)"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        {isEnglish ? "LUMO Band ID:" : "Mã vòng LUMO Band:"}
                      </label>
                      <input
                        type="text"
                        value={activeEditingPerson.device_id || ""}
                        onChange={(e) => updatePersonProfile(activeEditingPerson.id, { device_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-cyan-300 focus:border-teal-500 outline-none"
                        placeholder="LH-8821"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Caregiver & Contact Phone:" : "Người chăm sóc / Con cái liên hệ:"}
                    </label>
                    <input
                      type="text"
                      value={activeEditingPerson.caregiver || ""}
                      onChange={(e) => updatePersonProfile(activeEditingPerson.id, { caregiver: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-teal-500 outline-none"
                      placeholder="Anh Trí (Con trai - 0988 123 456)"
                    />
                  </div>
                </div>

                {/* Emoji Pickers */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {isEnglish ? "Avatar Emoji:" : "Biểu tượng:"}
                  </label>
                  <div className="flex gap-2">
                    {["👵", "👴", "🧓", "👩", "👨", "❤️"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => updatePersonProfile(activeEditingPerson.id, { icon: emoji })}
                        className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border transition-all ${
                          activeEditingPerson.icon === emoji
                            ? "bg-teal-600/30 border-teal-400 scale-110"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Battery Slider */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <BatteryCharging size={15} className="text-emerald-400" /> {isEnglish ? `Band Battery (${activeEditingPerson.name}):` : `Pin vòng (${activeEditingPerson.name}):`}
                    </span>
                    <strong className="text-emerald-400 font-mono text-sm">{activeEditingPerson.batteryLevel ?? 88}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={activeEditingPerson.batteryLevel ?? 88}
                    onChange={(e) => updatePersonProfile(activeEditingPerson.id, { batteryLevel: Number(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[15, 25, 50, 88, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updatePersonProfile(activeEditingPerson.id, { batteryLevel: val })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${
                          activeEditingPerson.batteryLevel === val
                            ? "bg-emerald-600/30 text-emerald-300 border-emerald-500"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activity Slider */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Activity size={15} className="text-blue-400" /> {isEnglish ? "Activity today:" : "Vận động hôm nay:"}
                    </span>
                    <strong className="text-blue-400 font-mono text-sm">{activeEditingPerson.activityMinutes ?? 45} {isEnglish ? "mins" : "phút"}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    value={activeEditingPerson.activityMinutes ?? 45}
                    onChange={(e) => updatePersonProfile(activeEditingPerson.id, { activityMinutes: Number(e.target.value) })}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Checkin & Fall Sensor Status */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Check-in today:" : "Điểm danh hôm nay:"}
                    </label>
                    <button
                      type="button"
                      onClick={() => updatePersonProfile(activeEditingPerson.id, { 
                        checkedInToday: !activeEditingPerson.checkedInToday,
                        lastCheckInTime: !activeEditingPerson.checkedInToday ? "07:15" : null
                      })}
                      className={`w-full py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                        activeEditingPerson.checkedInToday
                          ? "bg-emerald-600/30 text-emerald-300 border-emerald-500"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                      }`}
                    >
                      {activeEditingPerson.checkedInToday ? (isEnglish ? "✓ Checked (07:15)" : "✓ Đã chạm (07:15)") : (isEnglish ? "Not yet" : "Chưa chạm")}
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      {isEnglish ? "Fall detection sensor:" : "Cảm biến té ngã:"}
                    </label>
                    <button
                      type="button"
                      onClick={() => updatePersonProfile(activeEditingPerson.id, { fallDetected: !activeEditingPerson.fallDetected })}
                      className={`w-full py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                        activeEditingPerson.fallDetected
                          ? "bg-red-600/40 text-red-200 border-red-500"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                      }`}
                    >
                      {activeEditingPerson.fallDetected ? (isEnglish ? "🚨 SOS Alert" : "🚨 Đang báo SOS") : (isEnglish ? "Safe" : "Bình thường")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Virtual Hardware & Hub Connection */}
          {activeTab === "hardware" && (
            <div className="p-4 space-y-4 overflow-y-auto max-h-[460px] text-xs">
              {/* Network Status Toggle */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Radio size={16} className="text-purple-400" /> {isEnglish ? "LUMO Hub (LB-100) Network:" : "Kết nối LUMO Hub (LB-100):"}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNetworkStatus("4g")}
                    className={`py-2 px-2 rounded-xl text-center font-bold border transition-all ${
                      networkStatus === "4g"
                        ? "bg-purple-600 text-white border-purple-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    4G LTE (eSIM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetworkStatus("wifi")}
                    className={`py-2 px-2 rounded-xl text-center font-bold border transition-all ${
                      networkStatus === "wifi"
                        ? "bg-blue-600 text-white border-blue-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Wi-Fi Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetworkStatus("offline")}
                    className={`py-2 px-2 rounded-xl text-center font-bold border transition-all ${
                      networkStatus === "offline"
                        ? "bg-red-600 text-white border-red-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Offline
                  </button>
                </div>
              </div>

              {/* Check In Days Slider */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[#ff8a4c]" /> {isEnglish ? "Consecutive check-in days:" : "Số ngày điểm danh liên tiếp:"}
                  </span>
                  <strong className="text-[#ff8a4c] font-mono text-sm">{mockCheckInDays} {isEnglish ? "days" : "ngày"}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="31"
                  value={mockCheckInDays}
                  onChange={(e) => setMockCheckInDays(Number(e.target.value))}
                  className="w-full accent-[#ff8a4c] cursor-pointer"
                />
              </div>

              {/* Reset Default Button */}
              <button
                type="button"
                onClick={() => {
                  resetToDefault();
                  setSelectedPersonId("profile_1");
                  toast.success(isEnglish ? "Restored initial standard demo state!" : "Đã khôi phục trạng thái demo chuẩn ban đầu!");
                }}
                className="w-full py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={15} /> {isEnglish ? "Restore standard demo data" : "Khôi phục dữ liệu demo chuẩn"}
              </button>
            </div>
          )}

          {/* Footer Status Bar & Exit Demo */}
          <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-2.5">
            <button
              type="button"
              onClick={() => {
                disableDemoMode();
                void logout();
                router.push("/dashboard");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
                }, 120);
                toast.info(isEnglish ? "Demo mode turned off. Please log in with your real account." : "Đã tắt chế độ Demo. Vui lòng đăng nhập tài khoản thật.");
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xs"
            >
              <LogOut size={15} className="text-red-400" />
              <span>{isEnglish ? "Exit Demo & Log in with Real Account" : "Tắt chế độ Demo & Đăng nhập tài khoản thật"}</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                LUMO Hub {networkStatus.toUpperCase()} · {isEnglish ? `${bandProfiles.length} family members` : `${bandProfiles.length} người thân`}
              </span>
              <span className="text-purple-400 font-medium shrink-0 text-[10px]">
                {isEnglish ? "Tap Logo 3x to reopen" : "Nhấn 3 lần Logo để mở lại"}
              </span>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
