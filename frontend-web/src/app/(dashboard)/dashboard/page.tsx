"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { BatteryFull, BatteryMedium, BatteryWarning, CalendarCheck2, Check, CheckCircle2, ChevronRight, Clock3, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore } from "@/store/demoStore";
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
    batteryLevel: demoBattery,
    activityMinutes: demoActivity,
    fallDetected: demoFall,
    checkedInToday: demoCheckedIn,
    lastCheckInTime: demoLastCheckIn,
  } = useDemoStore();

  const language = usePreferenceStore((state) => state.language);
  const isEnglish = language === "en";
  const [now, setNow] = useState<Date | null>(null);
  const [isBatteryModalOpen, setIsBatteryModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);

  useEffect(() => {
    setNow(new Date());
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
  const weekDays = dayLabels.map((label, index) => {
    const date = weekStart ? addDays(weekStart, index) : null;
    const key = date ? format(date, "yyyy-MM-dd") : "";
    const isTodayKey = Boolean(date && now && format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd"));
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

  const copy = isEnglish ? {
    checked: "Checked in today",
    waiting: "Not checked in yet",
    reassuring: "All good",
    pending: "Waiting",
    waitingHint: "Lumo is waiting for today's check-in.",
    lastCheck: "Last check-in",
    summary: "Daily overview",
    thisWeek: "This week",
    checkinDays: "Check-in days",
    dayUnit: "days",
    today: "Today",
    done: "Done",
    notYet: "Not yet",
    battery: "Band battery",
    noBattery: "No battery data",
    safety: "Fall detection",
    fall: "Fall detected",
    noFall: "No fall alert",
    noSafety: "No safety data",
    activity: "Movement today",
    minutes: "minutes active",
    noActivity: "No activity data",
    device: activeDevice ? `Lumo ${activeDevice.device_id}` : "No device connected",
    deviceHint: activeDevice ? "Hub and band monitoring is active" : "Connect a Lumo Hub and band to begin",
  } : {
    checked: "Mẹ đã chạm xác nhận trên LUMO Band",
    waiting: "Chưa nhận chạm xác nhận hôm nay",
    reassuring: "An tâm",
    pending: "Đang chờ Cha Mẹ",
    waitingHint: "Lumo đang chờ Cha Mẹ chạm mặt cảm biến trên LUMO Band để báo an tâm.",
    lastCheck: "Lần chạm Band gần nhất",
    summary: "Theo dõi an tâm Cha Mẹ từ xa",
    thisWeek: "Tuần này",
    checkinDays: "Ngày chạm xác nhận",
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
    noFall: "Cha Mẹ vẫn ổn",
    noSafety: "Chưa có tín hiệu",
    safetyActive: "Đang theo dõi 24/7",
    safetyAlert: "Vừa xảy ra · Nhấn kiểm tra",
    safetyConnecting: "Đang kết nối lại thiết bị",
    activity: "Vận động Cha Mẹ hôm nay",
    minutes: "phút vận động",
    noActivity: "Chưa có dữ liệu vận động",
    device: activeDevice ? `Lumo Hub & Band (${activeDevice.device_id})` : "Chưa liên kết thiết bị",
    deviceHint: activeDevice ? "Đang kết nối bảo vệ Cha Mẹ 24/7 từ xa" : "Liên kết Lumo Hub và vòng Band để bắt đầu theo dõi",
  };


  const getBatteryDisplay = (level: number | null | undefined) => {
    if (typeof level !== "number") return { icon: null, text: "--", color: "" };
    let Icon = BatteryFull;
    let color = "text-emerald-500 dark:text-emerald-400";
    if (level <= 20) {
      Icon = BatteryWarning;
      color = "text-red-500 dark:text-red-400";
    } else if (level <= 50) {
      Icon = BatteryMedium;
      color = "text-amber-500 dark:text-amber-400";
    }
    return {
      icon: <Icon size={20} strokeWidth={2.5} className={`mr-1 ${color}`} />,
      text: `${level}%`,
      color
    };
  };

  const batteryData = getBatteryDisplay(batteryLevel);

  return (
    <div className="lumo-page dashboard-overview">
      <section className="health-summary-card" aria-label={copy.summary}>
        <div className="care-summary-heading">
          <div><span><ShieldCheck size={20} /></span><strong>{copy.summary}</strong></div>
          <em className={checkedIn ? "safe" : "pending"}>{checkedIn ? copy.reassuring : copy.pending}</em>
        </div>

        <div className={`care-status-banner ${checkedIn ? "safe" : "pending"}`}>
          <span>{checkedIn ? <CheckCircle2 size={25} /> : <Clock3 size={25} />}</span>
          <div><small>{copy.today}</small><strong>{checkedIn ? copy.checked : copy.waiting}</strong><p>{lastCheckTime ? `${copy.lastCheck} ${lastCheckTime}` : copy.waitingHint}</p></div>
        </div>

        <div className="weekly-checkin">
          <div className="weekly-checkin-heading"><span>{copy.thisWeek}</span><strong>{weeklyCheckins}/7 {copy.dayUnit}</strong></div>
          <div className="weekly-checkin-days">
            {weekDays.map((day, index) => (
              <div className={`${day.checked ? "checked" : ""} ${day.today ? "today" : ""} ${day.future ? "future" : ""}`} key={`${day.label}-${index}`}>
                <span>{day.label}</span><i>{day.checked ? <Check size={14} /> : null}</i>
              </div>
            ))}
          </div>
        </div>

        <div className="health-summary-metrics">
          <div className="summary-metric checkin">
            <span><CalendarCheck2 size={15} />{copy.checkinDays}</span>
            <strong>{weeklyCheckins}/7</strong>
            <small>{copy.thisWeek}</small>
          </div>
          <div className="summary-metric today">
            <span><CheckCircle2 size={15} />{copy.today}</span>
            <strong>{lastCheckTime ?? copy.notYet}</strong>
            <small>{checkedIn ? copy.checked : copy.waiting}</small>
          </div>
          <div className="summary-metric activity">
            <span><Timer size={15} />{copy.activity}</span>
            <strong>{typeof activityMinutes === "number" ? activityMinutes : "--"}</strong>
            <small>{copy.minutes}</small>
          </div>
        </div>
      </section>

      <section className="wellbeing-grid">
        <button onClick={() => setIsBatteryModalOpen(true)} className="wellbeing-card battery text-left">
          <span className="wellbeing-icon"><LumoBandIcon size={26} /></span>
          <div>
            <small>{copy.battery}</small>
            <strong className="flex items-center">
              {batteryData.icon}
              <span className={batteryData.color}>{batteryData.text}</span>
            </strong>
            <p>{typeof batteryLevel === "number" ? copy.batteryNormal : copy.noBattery}</p>
          </div>
        </button>

        <button onClick={() => setIsSafetyModalOpen(true)} className={`wellbeing-card safety text-left ${fallDetected ? "alert" : ""}`}>
          <span className="wellbeing-icon">{fallDetected ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}</span>
          <div><small>{fallDetected === undefined ? copy.safetyNoDataLabel : fallDetected ? copy.safetyAlertLabel : copy.safety}</small><strong>{fallDetected === true ? copy.fall : fallDetected === false ? copy.noFall : copy.noSafety}</strong><p>{fallDetected === undefined ? copy.safetyConnecting : fallDetected ? copy.safetyAlert : copy.safetyActive}</p></div>
        </button>

      </section>

      <Link href="/settings/devices" className="device-summary-row">
        <span><LumoBandIcon size={24} /></span>
        <div><strong>{copy.device}</strong><small>{copy.deviceHint}</small></div>
        <ChevronRight size={19} />
      </Link>

      <Modal open={isBatteryModalOpen} onClose={() => setIsBatteryModalOpen(false)} title={isEnglish ? "Battery Details" : "Chi tiết Pin"}>
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
          
          <div className="w-full mt-4 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setIsBatteryModalOpen(false)}>
              {isEnglish ? "Close" : "Đóng"}
            </Button>
            <Link href="/settings/devices" className="flex-1">
              <Button className="w-full">{isEnglish ? "Manage Devices" : "Quản lý thiết bị"}</Button>
            </Link>
          </div>
        </div>
      </Modal>

      <Modal open={isSafetyModalOpen} onClose={() => setIsSafetyModalOpen(false)} title={isEnglish ? "Fall Detection" : "Cảm biến Té ngã"}>
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

          <div className="w-full mt-4 flex gap-3">
            <Button className="flex-1" onClick={() => setIsSafetyModalOpen(false)}>
              {isEnglish ? "Understood" : "Đã hiểu"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
