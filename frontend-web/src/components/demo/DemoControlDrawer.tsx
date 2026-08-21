"use client";

import { useEffect, useState } from "react";
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
  Mic,
  Pill,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
  Zap,
  Bell,
  BellRing,
  Edit2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demoStore";

export default function DemoControlDrawer() {
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
    enableDemoMode,
    disableDemoMode,
    toggleDemoMode,
    toggleDrawer,
    setDrawerOpen,
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
    resetToDefault,
  } = useDemoStore();

  const [activeTab, setActiveTab] = useState<"scenarios" | "hardware" | "info">("scenarios");
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempName, setTempName] = useState(mockUser.full_name);

  // Global Keyboard shortcut: Ctrl+Shift+D or Alt+D to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") || (e.altKey && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        toggleDrawer();
        toast.info(isDrawerOpen ? "Đã đóng Demo Panel" : "Đã mở Bảng điều khiển Demo LUMO");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, toggleDrawer]);

  return (
    <>
      {/* Floating Discreet Trigger Button (Bottom Right) */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleDrawer}
          className={`group flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md border shadow-xl transition-all duration-200 ${
            isDrawerOpen
              ? "bg-purple-600 text-white border-purple-400 shadow-purple-500/30 scale-105"
              : "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-purple-500/50 hover:shadow-purple-500/20"
          }`}
          title="Mở Bảng điều khiển Demo LUMO (Ctrl + Shift + D)"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
          </span>
          <span className="text-xs font-bold tracking-wide flex items-center gap-1.5">
            <Sparkles size={14} className="text-purple-400 group-hover:rotate-12 transition-transform" />
            Demo Console
          </span>
          {isDrawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Drawer Overlay Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Main Floating Presenter Palette */}
      {isDrawerOpen && (
        <aside
          className="fixed bottom-0 sm:bottom-20 right-0 sm:right-4 z-50 w-full sm:w-[420px] max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-slate-900/95 border border-purple-500/40 shadow-2xl shadow-purple-950/80 backdrop-blur-xl text-white flex flex-col animate-in slide-in-from-bottom-5 duration-200"
          role="dialog"
          aria-label="Demo Controller"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-purple-900/50 via-slate-900 to-indigo-900/40 border-b border-slate-800 flex items-center justify-between">
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
                <p className="text-[11px] text-slate-400">Phím tắt bật/tắt nhanh: <code className="bg-slate-800 px-1 py-0.5 rounded text-purple-300">Ctrl+Shift+D</code></p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("scenarios")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "scenarios"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap size={14} /> Kịch bản Demo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hardware")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "hardware"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Settings2 size={14} /> Phần cứng ảo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "info"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity size={14} /> Hồ sơ mẫu
            </button>
          </div>

          {/* Tab 1: One-Click Presentation Scenarios */}
          {activeTab === "scenarios" && (
            <div className="p-4 space-y-3 overflow-y-auto max-h-[460px]">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Kích hoạt sự kiện thời gian thực (1 Chạm):
              </p>

              {/* 1. Fall Detection SOS */}
              <button
                type="button"
                onClick={() => {
                  triggerFallDetection();
                  toast.custom((t) => (
                    <div className="bg-[#2a1010] border border-red-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-2xl shadow-red-900/20 max-w-sm w-full">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert size={20} className="text-red-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Cảnh báo té ngã khẩn cấp</h4>
                        <p className="text-gray-300 text-xs mt-0.5">Hệ thống phát hiện cú ngã từ LUMO Band. Đã phát âm báo động.</p>
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
                    <h5 className="font-bold text-sm text-red-200">1. Giả lập Té Ngã (SOS)</h5>
                    <p className="text-xs text-slate-400">Báo động đỏ toàn màn hình + gửi tin khẩn</p>
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
                  toast.custom((t) => (
                    <div className="bg-[#102a31] border border-emerald-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-2xl shadow-emerald-900/20 max-w-sm w-full">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Gửi tín hiệu an tâm</h4>
                        <p className="text-gray-300 text-xs mt-0.5">Mẹ Mai vừa chạm mặt đồng hồ để báo an tâm. Con cái đã nhận được.</p>
                      </div>
                    </div>
                  ));
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-emerald-200">2. Mẹ chạm xác nhận trên LUMO Band</h5>
                    <p className="text-xs text-slate-400">Mô phỏng thao tác chạm trên Band ➔ App con cái nhận thông báo an tâm ngay</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40">
                  Touch Band
                </span>
              </button>


              {/* 3. Medication Reminder */}
              <button
                type="button"
                onClick={() => {
                  triggerMedicationReminder();
                  toast.custom((t) => (
                    <div className="bg-[#101b31] border border-blue-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-2xl shadow-blue-900/20 max-w-sm w-full">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Bell size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Lời nhắc uống thuốc</h4>
                        <p className="text-gray-300 text-xs mt-0.5">LUMO Hub vừa phát lời nhắc uống thuốc sáng tới Mẹ Mai.</p>
                      </div>
                    </div>
                  ));
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/50 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-600/30 border border-amber-500/50 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Pill size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-amber-200">3. Nhắc nhở uống thuốc</h5>
                    <p className="text-xs text-slate-400">Modal đơn thuốc kèm giọng nói gia đình</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40">
                  Reminder
                </span>
              </button>

              {/* 4. AI Voice Companion */}
              <button
                type="button"
                onClick={() => {
                  triggerVoiceCompanion();
                  toast.info("🎙️ Mở tương tác trợ lý giọng nói LUMO AI!");
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/50 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Bot size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-purple-200">4. Trợ lý AI LUMO Companion</h5>
                    <p className="text-xs text-slate-400">Sóng âm giọng nói & đối thoại thông minh</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40">
                  Voice AI
                </span>
              </button>

              {/* 5. System Push Notification */}
              <button
                type="button"
                onClick={() => {
                  if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("LUMO - An tâm mỗi ngày", {
                      body: "Chào buổi sáng! Hệ thống LUMO đang hoạt động bình thường, bảo vệ an toàn cho gia đình bạn.",
                      icon: "/icons/icon-192x192.png",
                    });
                  } else {
                    toast.custom((t) => (
                      <div className="bg-[#1a202c] border border-sky-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-2xl shadow-sky-900/20 max-w-sm w-full">
                        <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                          <BellRing size={20} className="text-sky-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">Hệ thống LUMO</h4>
                          <p className="text-gray-300 text-xs mt-0.5">Chào buổi sáng! Hệ thống đang hoạt động bình thường, bảo vệ gia đình bạn.</p>
                        </div>
                      </div>
                    ));
                  }
                }}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/40 to-slate-900 border border-sky-500/50 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/20 active:scale-[0.99] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600/30 border border-sky-500/50 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BellRing size={22} />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-sky-200">5. Gửi thông báo chung</h5>
                    <p className="text-xs text-slate-400">Gửi thông báo Push từ hệ thống LUMO</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-sky-600/30 text-sky-300 font-bold border border-sky-500/40">
                  Push
                </span>
              </button>
            </div>
          )}

          {/* Tab 2: Virtual Hardware Telemetry Sliders */}
          {activeTab === "hardware" && (
            <div className="p-4 space-y-4 overflow-y-auto max-h-[460px] text-xs">
              {/* Battery Slider */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <BatteryCharging size={16} className="text-emerald-400" /> Pin LUMO Band:
                  </span>
                  <strong className="text-emerald-400 font-mono text-sm">{batteryLevel}%</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={batteryLevel}
                  onChange={(e) => setBatteryLevel(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10% (Cảnh báo yếu)</span>
                  <span>50%</span>
                  <span>100% (Đầy pin)</span>
                </div>
              </div>

              {/* Activity & Steps (Pedometer & Movement) */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Activity size={16} className="text-blue-400" /> Đếm bước chân & Vận động:
                  </span>
                  <strong className="text-blue-400 font-mono text-sm">{stepsToday.toLocaleString("vi-VN")} bước ({activityMinutes} phút)</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={activityMinutes}
                  onChange={(e) => {
                    const mins = Number(e.target.value);
                    setActivityMinutes(mins);
                    setStepsToday(mins * 85);
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 bước</span>
                  <span>45 phút (Đạt mục tiêu)</span>
                  <span>10,000+ bước</span>
                </div>
              </div>

              {/* Check In Days Slider */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[#ff8a4c]" /> Số ngày điểm danh gần đây:
                  </span>
                  <strong className="text-[#ff8a4c] font-mono text-sm">{mockCheckInDays} ngày</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="31"
                  value={mockCheckInDays}
                  onChange={(e) => setMockCheckInDays(Number(e.target.value))}
                  className="w-full accent-[#ff8a4c] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 ngày</span>
                  <span>15 ngày</span>
                  <span>31 ngày</span>
                </div>
              </div>

              {/* Fall Sensor Toggle */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-400" /> Trạng thái cảm biến:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFallDetected(false)}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                      fallDetected === false
                        ? "bg-emerald-600 text-white border-emerald-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Bình thường
                  </button>
                  <button
                    type="button"
                    onClick={() => setFallDetected(true)}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                      fallDetected === true
                        ? "bg-red-600 text-white border-red-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Báo động
                  </button>
                  <button
                    type="button"
                    onClick={() => setFallDetected(undefined)}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                      fallDetected === undefined
                        ? "bg-slate-600 text-white border-slate-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Mất tín hiệu
                  </button>
                </div>
              </div>

              {/* Network Status Toggle */}

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Radio size={16} className="text-purple-400" /> Kết nối LUMO Hub:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNetworkStatus("4g")}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
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
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                      networkStatus === "wifi"
                        ? "bg-blue-600 text-white border-blue-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Wi-Fi Nhà
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetworkStatus("offline")}
                    className={`py-1.5 px-2 rounded-xl text-center font-bold border transition-all ${
                      networkStatus === "offline"
                        ? "bg-red-600 text-white border-red-400"
                        : "bg-slate-900 text-slate-400 border-slate-700"
                    }`}
                  >
                    Offline
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Mock Persona & Reset */}
          {activeTab === "info" && (
            <div className="p-4 space-y-3.5 overflow-y-auto max-h-[460px] text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h6 className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Hồ sơ đối tượng sử dụng mẫu:
                  </h6>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingInfo) {
                        setMockUser({ full_name: tempName });
                        toast.success("Đã cập nhật hồ sơ mẫu");
                      }
                      setIsEditingInfo(!isEditingInfo);
                    }}
                    className="text-slate-400 hover:text-emerald-400 p-1 bg-slate-900 rounded-md transition-colors"
                  >
                    {isEditingInfo ? <Save size={14} /> : <Edit2 size={14} />}
                  </button>
                </div>
                
                {isEditingInfo ? (
                  <div className="space-y-2 mt-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Người dùng chính</label>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-emerald-500 outline-none"
                        placeholder="Nhập tên..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-300">
                    <p>• <strong>Người dùng chính:</strong> {mockUser.full_name}</p>
                    <p>• <strong>Địa chỉ:</strong> Ba Đình, Hà Nội</p>
                    <p>• <strong>Người chăm sóc từ xa:</strong> Anh Trí (Con trai)</p>
                    <p>• <strong>Thiết bị:</strong> LUMO Hub 4G + LUMO Band (LH-8821)</p>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <h6 className="font-bold text-slate-200">Trạng thái Demo Mode:</h6>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Tự động nạp dữ liệu phong phú:</span>
                  <button
                    type="button"
                    onClick={() => {
                      toggleDemoMode();
                      toast.info(isDemoMode ? "Đã tắt chế độ Demo" : "Đã bật chế độ Demo");
                    }}
                    className={`px-3 py-1 rounded-xl font-bold border ${
                      isDemoMode
                        ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                        : "bg-slate-700 text-slate-400 border-slate-600"
                    }`}
                  >
                    {isDemoMode ? "ĐANG BẬT" : "TẮT"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetToDefault();
                  toast.success("Đã khôi phục trạng thái demo chuẩn ban đầu!");
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={15} /> Khôi phục dữ liệu ban đầu
              </button>
            </div>
          )}

          {/* Footer Status Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LUMO Hub {networkStatus.toUpperCase()} · Pin {batteryLevel}%
            </span>
            <span className="text-purple-400 font-medium">LuminosTech Demo</span>
          </div>
        </aside>
      )}
    </>
  );
}
