"use client";

import { useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarCheck2, CheckCircle2, ChevronRight, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { parseUTC } from "@/lib/utils";

function SummaryRings({ checkin, today, activity, label }: { checkin: number; today: number; activity: number; label: string }) {
  const rings = [
    { path: "M26 112 A64 64 0 1 1 154 112", value: checkin, className: "checkin" },
    { path: "M40 112 A50 50 0 1 1 140 112", value: today, className: "today" },
    { path: "M54 112 A36 36 0 1 1 126 112", value: activity, className: "activity" },
  ];

  return (
    <svg className="health-summary-rings" viewBox="0 0 180 126" role="img" aria-label={label}>
      {rings.map((ring) => <path key={`${ring.className}-track`} className={`summary-ring-track ${ring.className}`} d={ring.path} pathLength="100" />)}
      {rings.map((ring) => <path key={ring.className} className={`summary-ring-value ${ring.className}`} d={ring.path} pathLength="100" strokeDasharray={`${ring.value} 100`} />)}
    </svg>
  );
}

export default function DashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const { events, todayStatus, fetchEvents, fetchTodayStatus } = useEventButtonStore();
  const language = usePreferenceStore((state) => state.language);
  const isEnglish = language === "en";

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchTodayStatus();
    void fetchEvents();
    void fetchDevices();
  }, [fetchDevices, fetchEvents, fetchTodayStatus, isAuthenticated]);

  const activeDevice = devices.find((device) => device.is_active);
  const batteryLevel = activeDevice?.battery_level;
  const activityMinutes = activeDevice?.activity_minutes_today;
  const fallDetected = activeDevice?.fall_detected;
  const checkedIn = Boolean(todayStatus?.clicked_today);
  const checkinDays = new Set(events.map((event) => format(parseUTC(event.time_button_click), "yyyy-MM-dd"))).size;
  const checkinProgress = Math.min((checkinDays / 7) * 100, 100);
  const activityProgress = typeof activityMinutes === "number" ? Math.min((activityMinutes / 30) * 100, 100) : 0;

  const copy = isEnglish ? {
    checked: "Checked in today",
    waiting: "Not checked in yet",
    lastCheck: "Last check-in",
    summary: "Daily overview",
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
    checked: "Đã điểm danh hôm nay",
    waiting: "Chưa điểm danh hôm nay",
    lastCheck: "Lần gần nhất",
    summary: "Tổng quan hôm nay",
    checkinDays: "Ngày điểm danh",
    dayUnit: "ngày",
    today: "Hôm nay",
    done: "Đã",
    notYet: "Chưa",
    battery: "Pin vòng band",
    noBattery: "Chưa có dữ liệu pin",
    safety: "Phát hiện té ngã",
    fall: "Đã phát hiện té ngã",
    noFall: "Không có cảnh báo té ngã",
    noSafety: "Chưa có dữ liệu an toàn",
    activity: "Vận động hôm nay",
    minutes: "phút vận động",
    noActivity: "Chưa có dữ liệu vận động",
    device: activeDevice ? `Lumo ${activeDevice.device_id}` : "Chưa liên kết thiết bị",
    deviceHint: activeDevice ? "Hub và vòng band đang được theo dõi" : "Liên kết Lumo Hub và vòng band để bắt đầu",
  };

  return (
    <div className="lumo-page dashboard-overview">
      <section className="health-summary-card" aria-label={copy.summary}>
        <SummaryRings checkin={checkinProgress} today={checkedIn ? 100 : 0} activity={activityProgress} label={copy.summary} />
        <div className="health-summary-metrics">
          <div className="summary-metric checkin">
            <span><CalendarCheck2 size={15} />{copy.checkinDays}</span>
            <strong>{checkinDays}</strong>
            <small>{copy.dayUnit}</small>
          </div>
          <div className="summary-metric today">
            <span><CheckCircle2 size={15} />{copy.today}</span>
            <strong>{checkedIn ? copy.done : copy.notYet}</strong>
            <small>{todayStatus?.last_click_at ? `${copy.lastCheck} ${format(parseUTC(todayStatus.last_click_at), "HH:mm")}` : copy.waiting}</small>
          </div>
          <div className="summary-metric activity">
            <span><Timer size={15} />{copy.activity}</span>
            <strong>{typeof activityMinutes === "number" ? activityMinutes : "--"}</strong>
            <small>{copy.minutes}</small>
          </div>
        </div>
      </section>

      <section className="wellbeing-grid">
        <Link href="/settings/devices" className="wellbeing-card battery">
          <span className="wellbeing-icon"><LumoBandIcon size={26} /></span>
          <div><small>{copy.battery}</small><strong>{typeof batteryLevel === "number" ? `${batteryLevel}%` : "--"}</strong><p>{typeof batteryLevel === "number" ? copy.battery : copy.noBattery}</p></div>
        </Link>

        <div className={`wellbeing-card safety ${fallDetected ? "alert" : ""}`}>
          <span className="wellbeing-icon">{fallDetected ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}</span>
          <div><small>{copy.safety}</small><strong>{fallDetected === true ? copy.fall : fallDetected === false ? copy.noFall : "--"}</strong><p>{fallDetected === undefined ? copy.noSafety : fallDetected ? copy.fall : copy.noFall}</p></div>
        </div>

      </section>

      <Link href="/settings/devices" className="device-summary-row">
        <span><LumoBandIcon size={24} /></span>
        <div><strong>{copy.device}</strong><small>{copy.deviceHint}</small></div>
        <ChevronRight size={19} />
      </Link>
    </div>
  );
}
