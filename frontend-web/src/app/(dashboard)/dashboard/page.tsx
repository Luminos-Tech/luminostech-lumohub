"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths } from "date-fns";
import { BatteryFull, BatteryMedium, BatteryWarning, CalendarCheck2, Check, CheckCircle2, ChevronRight, ChevronLeft, Clock3, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore, formatDisplayPersonName } from "@/store/demoStore";
import { parseUTC } from "@/lib/utils";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";

export default function DashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const { events, todayStatus, fetchEvents, fetchTodayStatus } = useEventButtonStore();
  const {
    isDemoMode,
    mockDevice,
    mockTodayStatus,
    mockRecentEvents,
    mockProfiles,
    activeDashboardProfileId,
    setActiveDashboardProfileId
  } = useDemoStore();

  const activeProfile = mockProfiles?.find(p => p.id === activeDashboardProfileId) || mockProfiles?.[1];
  const profileDeviceId = activeProfile?.device_id || "LH-8821";
  const demoBattery = activeProfile?.batteryLevel ?? 88;
  const demoActivity = activeProfile?.activityMinutes ?? 45;
  const demoFall = activeProfile?.fallDetected ?? false;
  const demoCheckedIn = activeProfile?.checkedInToday ?? true;
  const demoLastCheckIn = activeProfile?.lastCheckInTime ?? "07:15";

  const language = usePreferenceStore((state) => state.language);
  const isEnglish = language === "en";
  const [now, setNow] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  useEffect(() => {
    const d = new Date();
    setNow(d);
    setCurrentMonth(d);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchTodayStatus();
    void fetchEvents();
    void fetchDevices();
  }, [fetchDevices, fetchEvents, fetchTodayStatus, isAuthenticated]);

  const rawActiveDevice = devices.find((device) => device.is_active);
  const activeDevice = rawActiveDevice || (isDemoMode ? {
    ...mockDevice,
    device_id: profileDeviceId,
    battery_level: demoBattery,
    activity_minutes_today: demoActivity,
    fall_detected: demoFall,
  } : undefined);

  const batteryLevel = isDemoMode ? demoBattery : (activeDevice?.battery_level);
  const activityMinutes = isDemoMode ? demoActivity : (activeDevice?.activity_minutes_today);
  const fallDetected = isDemoMode ? demoFall : (activeDevice?.fall_detected);
  const checkedIn = isDemoMode ? demoCheckedIn : Boolean(todayStatus?.clicked_today);

  const effectiveEvents = events.length > 0 ? events : (isDemoMode ? mockRecentEvents : []);
  const eventDays = new Set(effectiveEvents.map((event) => format(parseUTC(event.time_button_click), "yyyy-MM-dd")));
  const weekStart = now ? startOfWeek(now, { weekStartsOn: 1 }) : null;
  const dayLabels = isEnglish ? ["M", "T", "W", "T", "F", "S", "S"] : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const todayKey = now ? format(now, "yyyy-MM-dd") : "";
  const weekDays = dayLabels.map((label, index) => {
    const date = weekStart ? addDays(weekStart, index) : null;
    const key = date ? format(date, "yyyy-MM-dd") : "";
    const isTodayKey = Boolean(key && todayKey && key === todayKey);
    return {
      label,
      checked: isTodayKey ? checkedIn : Boolean(key && eventDays.has(key)),
      today: isTodayKey,
      future: Boolean(date && now && date.getTime() > now.getTime()),
    };
  });
  const weeklyCheckins = weekDays.filter((day) => day.checked).length;
  const lastCheckTime = isDemoMode
    ? (demoCheckedIn ? (demoLastCheckIn || "07:15") : null)
    : (todayStatus?.last_click_at ? format(parseUTC(todayStatus.last_click_at), "HH:mm") : null);

  const monthStart = currentMonth ? startOfMonth(currentMonth) : null;
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null;
  const monthDays = monthStart && monthEnd ? eachDayOfInterval({ start: monthStart, end: monthEnd }) : [];
  const monthStartDayOfWeek = monthStart ? (monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1) : 0;

  const isOverview = activeProfile?.type === 'overview';
  const profileName = isOverview ? (isEnglish ? 'Family' : 'Cha Mẹ') : formatDisplayPersonName(activeProfile?.name || '', isEnglish);

  const copy = isEnglish ? {
    checked: "Checked in today",
    waiting: "Not checked in yet",
    reassuring: "All good",
    pending: "Waiting",
    waitingHint: isOverview ? "Lumo is waiting for today's check-in from everyone." : `Lumo is waiting for ${profileName} to touch the LUMO Band.`,
    lastCheck: "Last check-in",
    summary: isOverview ? "Remote family care overview" : `${profileName} care overview`,
    thisWeek: "This week",
    checkinDays: "Check-in days",
    monthlyCheckins: "Monthly check-ins",
    dayUnit: "days",
    today: "Today",
    done: "Done",
    notYet: "Not yet",
    battery: "Band battery",
    noBattery: "No battery data",
    batteryNormal: "Normal status",
    safety: "Fall detection",
    safetyAlertLabel: "Fall alert ⚠️",
    safetyNoDataLabel: "Fall sensor ⚪",
    fall: "Fall detected",
    noFall: isOverview ? "Everyone is safe" : `${profileName} is safe`,
    noSafety: "No signal",
    safetyActive: "Monitoring 24/7",
    safetyAlert: "Just detected · Check now",
    safetyConnecting: "Reconnecting device",
    activity: "Movement today",
    minutes: "mins",
    noActivity: "No activity data",
    device: activeDevice ? `Lumo Hub & Band (${activeDevice.device_id})` : "No device connected",
    deviceHint: activeDevice ? "Connected and protecting 24/7" : "Connect Lumo Hub and Band to start",
  } : {
    checked: isOverview ? "Mọi người đều đã chạm xác nhận" : `${profileName} đã chạm xác nhận`,
    waiting: isOverview ? "Chưa nhận đủ chạm xác nhận hôm nay" : `Chưa nhận được xác nhận từ ${profileName}`,
    reassuring: "An tâm",
    pending: "Đang theo dõi",
    waitingHint: isOverview ? "Lumo đang chờ xác nhận an tâm từ mọi người." : `Lumo đang chờ ${profileName} chạm mặt cảm biến trên LUMO Band để báo an tâm.`,
    lastCheck: "Lần chạm Band gần nhất",
    summary: isOverview ? "Theo dõi an tâm gia đình từ xa" : `Theo dõi an tâm ${profileName} từ xa`,
    thisWeek: "Tuần này",
    checkinDays: "Ngày chạm xác nhận",
    monthlyCheckins: "Lịch sử tháng này",
    dayUnit: "ngày",
    today: "Hôm nay",
    done: "Đã xác nhận",
    notYet: "Chưa chạm Band",
    battery: "Pin LUMO Band",
    noBattery: "Chưa có dữ liệu pin",
    batteryNormal: "Hoạt động bình thường",
    safety: "Cảm biến té ngã",
    safetyAlertLabel: "Cảm biến té ngã ⚠️",
    safetyNoDataLabel: "Cảm biến té ngã ⚪",
    fall: "Phát hiện té ngã",
    noFall: isOverview ? "Mọi người vẫn ổn" : `${profileName} vẫn ổn`,
    noSafety: "Chưa có tín hiệu",
    safetyActive: "Đang theo dõi 24/7",
    safetyAlert: "Vừa xảy ra · Nhấn kiểm tra",
    safetyConnecting: "Đang kết nối lại thiết bị",
    activity: "Vận động hôm nay",
    minutes: "phút",
    noActivity: "Chưa có dữ liệu vận động",
    device: activeDevice ? `Lumo Hub & Band (${activeDevice.device_id})` : "Chưa liên kết thiết bị",
    deviceHint: activeDevice ? "Đang kết nối bảo vệ 24/7 từ xa" : "Liên kết Lumo Hub và vòng Band để bắt đầu theo dõi",
  };


  const getBatteryDisplay = (level: number | null | undefined) => {
    if (typeof level !== "number") return { icon: null, text: "--", color: "text-slate-400 dark:text-teal-400" };
    let color = "text-teal-600 dark:text-[#2dd4bf]";
    if (level <= 20) {
      color = "text-red-500 dark:text-red-400";
    } else if (level <= 50) {
      color = "text-amber-500 dark:text-amber-400";
    }
    return {
      icon: (
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 ${color}`}
        >
          <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
          <line x1="22" y1="11" x2="22" y2="13" />
          <line x1="6" y1="10.5" x2="6" y2="13.5" strokeWidth="2.2" />
          <line x1="10" y1="10.5" x2="10" y2="13.5" strokeWidth="2.2" />
          <line x1="14" y1="10.5" x2="14" y2="13.5" strokeWidth="2.2" />
        </svg>
      ),
      text: `${level}%`,
      color
    };
  };

  const batteryData = getBatteryDisplay(batteryLevel);

  return (
    <div className="lumo-page dashboard-overview">
      {/* Profile Selector - Always on 1 single row */}
      {(() => {
        const displayProfiles = mockProfiles?.filter(p => p.type !== 'hub') || [];
        const colsClass = displayProfiles.length === 2 ? "grid-cols-2" : "grid-cols-3";
        return (
          <div className={`grid ${colsClass} gap-2 pb-4 pt-1.5 w-full`}>
            {displayProfiles.map((p) => {
              const isActive = activeDashboardProfileId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveDashboardProfileId(p.id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-[14px] border transition-all duration-200 shadow-xs w-full text-center active:scale-[0.98] ${
                    isActive 
                      ? "bg-slate-900 dark:bg-[#102a31] border-slate-900 dark:border-sky-500/60 text-white shadow-md ring-1 ring-sky-500/30" 
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500/40 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <span className="text-base sm:text-lg shrink-0">{p.icon}</span>
                  <span className="font-bold text-[13px] sm:text-[14px] tracking-wide truncate">
                    {formatDisplayPersonName(p.name, isEnglish)}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

      <section className="health-summary-card" aria-label={copy.summary}>
        <div className="care-summary-heading">
          <div><span><ShieldCheck size={20} /></span><strong>{copy.summary}</strong></div>
          <em className={checkedIn ? "safe" : "pending"}>{checkedIn ? copy.reassuring : copy.pending}</em>
        </div>

        {isOverview && (() => {
          const bandProfiles = mockProfiles?.filter(p => p.type === 'band') || [];
          return (
          <div className="grid grid-cols-2 gap-3 mt-4" style={{ gridAutoRows: 'auto' }}>
            {/* Row 1: Check-in & Reassurance */}
            {bandProfiles.map(p => (
              <div 
                key={`checkin-${p.id}`} 
                className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border shadow-xs transition-all ${
                  p.checkedInToday 
                    ? "bg-gradient-to-br from-[#ecfdf5] via-[#f0fdf4] to-[#d1fae5]/50 border-[#a7f3d0] text-[#065f46] dark:bg-gradient-to-br dark:from-[#064e3b]/35 dark:to-[#062c22]/60 dark:border-[#047857]/50 dark:text-[#a7f3d0]" 
                    : "bg-gradient-to-br from-[#fffbeb] via-[#fef3c7]/60 to-[#fde68a]/40 border-[#fcd34d] text-[#92400e] dark:bg-gradient-to-br dark:from-[#451a03]/35 dark:to-[#291003]/60 dark:border-[#b45309]/50 dark:text-[#fde68a]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <span className="font-bold text-[15px]">{formatDisplayPersonName(p.name, isEnglish)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.checkedInToday ? <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" /> : <Clock3 size={16} className="text-amber-600 dark:text-amber-400" />}
                  <strong className="text-[14px] font-bold">
                    {p.checkedInToday ? (isEnglish ? "Checked in ✓" : "Đã chạm ✓") : (isEnglish ? "Not checked ⏳" : "Chưa chạm ⏳")}
                  </strong>
                </div>
                <p className="text-[11px] opacity-80 pl-5 font-medium">
                  {p.checkedInToday ? `${copy.lastCheck} ${p.lastCheckInTime}` : (isEnglish ? "Waiting for sensor touch" : "Chờ chạm cảm biến")}
                </p>
              </div>
            ))}

            {/* Row 2: Activity — Sky / Ocean Blue theme 🌊 */}
            {bandProfiles.map(p => (
              <div 
                key={`activity-${p.id}`} 
                className="flex flex-col gap-1.5 p-3.5 rounded-[18px] border border-sky-200/90 dark:border-sky-800/50 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe]/70 to-[#bae6fd]/30 dark:bg-gradient-to-br dark:from-[#082f49]/60 dark:to-[#0c1e33] shadow-xs hover:border-sky-300 dark:hover:border-sky-700 transition-all"
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-sky-500/15 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300">
                    <Timer size={13} />
                  </span>
                  <small className="text-[12px] text-[#0284c7] dark:text-[#7dd3fc] font-semibold">{isEnglish ? "Activity today" : "Vận động hôm nay"}</small>
                </div>
                <strong className="text-[22px] font-extrabold text-[#0369a1] dark:text-[#38bdf8] tracking-tight">
                  {p.activityMinutes ?? "--"} <span className="text-xs font-normal text-[#0284c7] dark:text-[#7dd3fc]">{copy.minutes}</span>
                </strong>
                <span className="text-[11px] text-[#0284c7]/80 dark:text-[#7dd3fc]/70 font-medium">{isEnglish ? "Active movement tracking" : "Đang theo dõi vận động"}</span>
              </div>
            ))}

            {/* Row 3: Battery — Fresh Teal / Coral Amber theme 🔋 */}
            {bandProfiles.map(p => {
              const bData = getBatteryDisplay(p.batteryLevel);
              const isLow = typeof p.batteryLevel === "number" && p.batteryLevel <= 20;
              return (
                <button 
                  key={`battery-${p.id}`} 
                  onClick={() => setIsBatteryModalOpen(true)} 
                  className={`flex flex-col gap-1.5 p-3.5 rounded-[18px] border shadow-xs text-left active:scale-[0.98] transition-all ${
                    isLow
                      ? "border-amber-200/90 dark:border-amber-800/50 bg-gradient-to-br from-[#fff7ed] via-[#ffedd5]/70 to-[#fed7aa]/40 dark:bg-gradient-to-br dark:from-[#431407]/60 dark:to-[#270c04]"
                      : "border-teal-200/90 dark:border-teal-800/50 bg-gradient-to-br from-[#f0fdfa] via-[#ccfbf1]/60 to-[#99f6e4]/30 dark:bg-gradient-to-br dark:from-[#134e4a]/60 dark:to-[#042f2e]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isLow ? "bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300" : "bg-teal-500/15 text-teal-600 dark:bg-teal-400/20 dark:text-teal-300"
                    }`}>
                      <LumoBandIcon size={13} />
                    </span>
                    <small className={`text-[12px] font-semibold ${
                      isLow ? "text-[#c2410c] dark:text-[#fed7aa]" : "text-[#0d9488] dark:text-[#5eead4]"
                    }`}>{isEnglish ? "Band battery" : "Pin LUMO Band"}</small>
                  </div>
                  <strong className="text-[22px] font-extrabold flex items-center gap-1.5 tracking-tight">
                    {bData.icon} <span className={bData.color}>{bData.text}</span>
                  </strong>
                  <span className={`text-[11px] font-medium ${
                    isLow ? "text-[#c2410c]/80 dark:text-[#fed7aa]/70" : "text-[#0d9488]/80 dark:text-[#5eead4]/70"
                  }`}>{copy.batteryNormal}</span>
                </button>
              );
            })}

            {/* Row 4: Fall detection — Royal Purple / Red Alert theme 🛡️ */}
            {bandProfiles.map(p => {
              const fall = p.fallDetected;
              return (
                <button 
                  key={`fall-${p.id}`} 
                  onClick={() => setIsSafetyModalOpen(true)} 
                  className={`flex flex-col gap-1.5 p-3.5 rounded-[18px] border shadow-xs text-left active:scale-[0.98] transition-all ${
                    fall 
                      ? "border-red-300 dark:border-red-600/60 bg-gradient-to-br from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3] dark:bg-gradient-to-br dark:from-[#4c0519]/70 dark:to-[#2b030e] animate-pulse" 
                      : "border-purple-200/90 dark:border-purple-800/50 bg-gradient-to-br from-[#faf5ff] via-[#f3e8ff]/70 to-[#e9d5ff]/40 dark:bg-gradient-to-br dark:from-[#3b0764]/50 dark:to-[#1e0836] hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      fall 
                        ? "bg-red-500/20 text-red-600 dark:text-red-400" 
                        : "bg-purple-500/15 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300"
                    }`}>
                      {fall ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                    </span>
                    <small className={`text-[12px] font-semibold ${
                      fall ? "text-red-700 dark:text-red-300" : "text-[#7e22ce] dark:text-[#c084fc]"
                    }`}>{isEnglish ? "Fall detection" : "Cảm biến té ngã"}</small>
                  </div>
                  <strong className={`text-[17px] font-extrabold tracking-tight ${
                    fall ? "text-red-700 dark:text-red-300" : "text-[#581c87] dark:text-[#e9d5ff]"
                  }`}>
                    {fall === true ? copy.fall : fall === false ? (isEnglish ? `${formatDisplayPersonName(p.name, true)} is safe` : `${formatDisplayPersonName(p.name, false)} vẫn ổn`) : copy.noSafety}
                  </strong>
                  <span className={`text-[11px] font-semibold ${
                    fall ? "text-red-600 dark:text-red-400" : "text-[#15803d] dark:text-[#4ade80]"
                  }`}>
                    {fall ? copy.safetyAlert : copy.safetyActive}
                  </span>
                </button>
              );
            })}
          </div>
          );
        })()}
        {!isOverview && (
          <>
            <div className={`care-status-banner ${checkedIn ? "safe" : "pending"}`}>
              <span>{checkedIn ? <CheckCircle2 size={25} /> : <Clock3 size={25} />}</span>
              <div><small>{copy.today}</small><strong>{checkedIn ? copy.checked : copy.waiting}</strong><p>{lastCheckTime ? `${copy.lastCheck} ${lastCheckTime}` : copy.waitingHint}</p></div>
            </div>

            <button onClick={() => setIsCalendarModalOpen(true)} className="weekly-checkin w-full text-left cursor-pointer transition-transform active:scale-[0.98]">
              <div className="weekly-checkin-heading"><span>{copy.thisWeek}</span><strong>{weeklyCheckins}/7 {copy.dayUnit}</strong></div>
              <div className="weekly-checkin-days">
                {weekDays.map((day, index) => (
                  <div className={`${day.checked ? "checked" : ""} ${day.today ? "today" : ""} ${day.future ? "future" : ""}`} key={`${day.label}-${index}`}>
                    <span>{day.label}</span><i>{day.checked ? <Check size={14} /> : null}</i>
                  </div>
                ))}
              </div>
            </button>

            <div className="mt-3 flex flex-col gap-3">
              {/* Activity Card — Sky Blue */}
              <div className="flex items-center gap-3.5 p-4 rounded-[20px] border border-sky-200/90 dark:border-sky-800/50 bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe]/70 to-[#bae6fd]/30 dark:bg-gradient-to-br dark:from-[#082f49]/60 dark:to-[#0c1e33] shadow-xs">
                <span className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-sky-500/15 text-sky-600 dark:bg-sky-400/20 dark:text-sky-300">
                  <Timer size={20} />
                </span>
                <div className="flex flex-col flex-1">
                  <span className="text-[14px] text-[#0284c7] dark:text-[#7dd3fc] font-semibold leading-tight">{isEnglish ? "Activity today" : `Vận động của ${profileName} hôm nay`}</span>
                  <span className="text-[12px] text-[#0284c7]/80 dark:text-[#7dd3fc]/70 mt-0.5 font-medium">{isEnglish ? "Daily movement tracking" : "Theo dõi thời gian vận động"}</span>
                </div>
                <strong className="text-[26px] font-extrabold text-[#0369a1] dark:text-[#38bdf8]">
                  {activityMinutes ?? "--"} <span className="text-xs font-normal text-[#0284c7] dark:text-[#7dd3fc]">{copy.minutes}</span>
                </strong>
              </div>

              {/* Battery & Fall side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Battery — Fresh Teal */}
                <button
                  onClick={() => setIsBatteryModalOpen(true)}
                  className="flex flex-col p-4 rounded-[20px] border border-teal-200/90 dark:border-teal-800/50 bg-gradient-to-br from-[#f0fdfa] via-[#ccfbf1]/60 to-[#99f6e4]/30 dark:bg-gradient-to-br dark:from-[#134e4a]/60 dark:to-[#042f2e] shadow-xs text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-teal-500/15 text-teal-600 dark:bg-teal-400/20 dark:text-teal-300">
                      <LumoBandIcon size={16} />
                    </span>
                    <span className="text-[13.5px] sm:text-[14px] text-[#0d9488] dark:text-[#5eead4] font-semibold leading-tight">{copy.battery}</span>
                  </div>
                  <strong className="text-[24px] sm:text-[26px] font-extrabold flex items-center gap-2 mb-1.5 tracking-tight">
                    {batteryData.icon} <span className={batteryData.color}>{batteryData.text}</span>
                  </strong>
                  <span className="text-[12px] sm:text-[12.5px] text-[#0d9488]/80 dark:text-[#5eead4]/70 mt-auto leading-snug font-medium">
                    {typeof batteryLevel === "number" ? copy.batteryNormal : copy.noBattery}
                  </span>
                </button>

                {/* Fall detection — Purple / Red */}
                <button
                  onClick={() => setIsSafetyModalOpen(true)}
                  className={`flex flex-col p-4 rounded-[20px] border shadow-xs text-left active:scale-[0.98] transition-all ${
                    fallDetected
                      ? "border-red-300 dark:border-red-600/60 bg-gradient-to-br from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3] dark:bg-gradient-to-br dark:from-[#4c0519]/70 dark:to-[#2b030e] animate-pulse"
                      : "border-purple-200/90 dark:border-purple-800/50 bg-gradient-to-br from-[#faf5ff] via-[#f3e8ff]/70 to-[#e9d5ff]/40 dark:bg-gradient-to-br dark:from-[#3b0764]/50 dark:to-[#1e0836]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        fallDetected
                          ? "bg-red-500/20 text-red-600 dark:text-red-400"
                          : "bg-purple-500/15 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300"
                      }`}
                    >
                      {fallDetected ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                    </span>
                    <span
                      className={`text-[13.5px] sm:text-[14px] font-semibold leading-tight ${
                        fallDetected ? "text-red-700 dark:text-red-300" : "text-[#7e22ce] dark:text-[#c084fc]"
                      }`}
                    >
                      {fallDetected === undefined ? copy.safetyNoDataLabel : fallDetected ? copy.safetyAlertLabel : copy.safety}
                    </span>
                  </div>
                  <strong
                    className={`text-[20px] sm:text-[22px] font-extrabold mb-1.5 tracking-tight leading-snug ${
                      fallDetected ? "text-red-700 dark:text-red-300" : "text-[#581c87] dark:text-[#e9d5ff]"
                    }`}
                  >
                    {fallDetected === true ? copy.fall : fallDetected === false ? copy.noFall : copy.noSafety}
                  </strong>
                  <span
                    className={`text-[12px] sm:text-[12.5px] mt-auto leading-snug font-semibold ${
                      fallDetected ? "text-red-600 dark:text-red-400" : "text-[#15803d] dark:text-[#4ade80]"
                    }`}
                  >
                    {fallDetected === undefined ? copy.safetyConnecting : fallDetected ? copy.safetyAlert : copy.safetyActive}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {!isOverview && (
        <Link href="/settings/devices" className="device-summary-row">
          <span><LumoBandIcon size={24} /></span>
          <div><strong>{copy.device}</strong><small>{copy.deviceHint}</small></div>
          <ChevronRight size={19} />
        </Link>
      )}

      <Modal open={isBatteryModalOpen} onClose={() => setIsBatteryModalOpen(false)}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
            <LumoBandIcon size={48} className="text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
              {batteryData.icon}
              <span className={batteryData.color}>{batteryData.text}</span>
            </h3>
            <p className="text-gray-500 font-medium mt-1">
              {typeof batteryLevel === "number" ? copy.batteryNormal : copy.noBattery}
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 p-4 rounded-xl text-sm w-full mt-2">
            {isEnglish 
              ? (typeof batteryLevel === "number" && batteryLevel <= 20 
                  ? "Battery is low. Please charge the device as soon as possible." 
                  : "Battery is sufficient for continuous monitoring. Recommend charging when below 20%.")
              : (typeof batteryLevel === "number" && batteryLevel <= 20 
                  ? "Pin đang ở mức thấp. Vui lòng sạc thiết bị càng sớm càng tốt để đảm bảo kết nối." 
                  : "Lượng pin đủ để hoạt động liên tục. Nên sạc thiết bị khi pin dưới 20%.")
            }
          </div>
          
          <div className="w-full mt-4 flex">
            <Link href="/settings/devices" className="flex-1">
              <Button className="w-full">{isEnglish ? "Manage Devices" : "Quản lý thiết bị"}</Button>
            </Link>
          </div>
        </div>
      </Modal>

      <Modal open={isSafetyModalOpen} onClose={() => setIsSafetyModalOpen(false)}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className={`p-4 rounded-full ${fallDetected ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
            {fallDetected ? <ShieldAlert size={48} /> : <ShieldCheck size={48} />}
          </div>
          
          <div>
            <h3 className="text-xl font-bold">
              {fallDetected === true ? copy.fall : fallDetected === false ? copy.noFall : copy.noSafety}
            </h3>
            <p className="text-gray-500 font-medium mt-1">
              {fallDetected === undefined ? copy.safetyConnecting : fallDetected ? copy.safetyAlert : copy.safetyActive}
            </p>
          </div>

          <div className={`p-4 rounded-xl text-sm w-full mt-2 ${fallDetected ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {fallDetected 
              ? (isEnglish 
                  ? "A fall has been detected! Please contact the user immediately to check their safety. If it's a false alarm, you can ignore this." 
                  : "Cảm biến vừa ghi nhận một cú ngã! Vui lòng liên hệ ngay với Cha/Mẹ để kiểm tra tình trạng. Nếu đây là báo động nhầm, bạn có thể bỏ qua.")
              : (isEnglish
                  ? "Fall detection is active 24/7. An alert will be sent immediately if a sudden fall is detected."
                  : "Cảm biến té ngã đang hoạt động 24/7. Hệ thống sẽ tự động gửi cảnh báo khẩn cấp nếu phát hiện Cha/Mẹ bị ngã.")
            }
          </div>

        </div>
      </Modal>

      <Modal open={isCalendarModalOpen} onClose={() => { setIsCalendarModalOpen(false); setCurrentMonth(now); }}>
        <div className="p-1 pb-2">
          <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-[#102a31] rounded-lg p-1">
            <button onClick={() => setCurrentMonth(prev => prev ? subMonths(prev, 1) : null)} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-[#183840] rounded-md transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
              {currentMonth ? format(currentMonth, "MM / yyyy") : ""}
            </span>
            <button onClick={() => setCurrentMonth(prev => prev ? addMonths(prev, 1) : null)} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-[#183840] rounded-md transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-4">
            {dayLabels.map(label => (
              <span key={label} className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{label}</span>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-y-3 gap-x-1 justify-items-center">
            {Array.from({ length: monthStartDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            
            {monthDays.map((day, i) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const isTodayKey = Boolean(todayKey && dateKey === todayKey);
              const isChecked = eventDays.has(dateKey) || (isTodayKey && checkedIn);
              const isFuture = day.getTime() > (now?.getTime() ?? 0) && !isTodayKey;
              
              return (
                <div key={i} className="flex flex-col items-center gap-1 w-full">
                  <span className={`text-[10px] font-semibold ${isTodayKey ? "text-[#d7652b]" : "text-gray-500"}`}>
                    {format(day, "d")}
                  </span>
                  <div className={`w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] rounded-full border-[2px] flex items-center justify-center transition-all
                    ${isChecked ? "border-[#ff8a4c] bg-[#ff8a4c] text-white" : "border-[#dce6e7] dark:border-gray-700 bg-white dark:bg-[#102a31] text-transparent"}
                    ${isTodayKey && !isChecked ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_#e4b51d] dark:shadow-[0_0_0_2px_#102a31,0_0_0_4px_#e4b51d]" : ""}
                    ${isFuture ? "opacity-30" : ""}
                  `}>
                    {isChecked && <Check size={14} strokeWidth={3.5} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
