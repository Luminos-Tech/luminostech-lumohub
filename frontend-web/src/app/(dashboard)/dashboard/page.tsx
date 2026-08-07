"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { CalendarCheck2, Check, CheckCircle2, ChevronRight, Clock3, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { parseUTC } from "@/lib/utils";

export default function DashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const { events, todayStatus, fetchEvents, fetchTodayStatus } = useEventButtonStore();
  const language = usePreferenceStore((state) => state.language);
  const isEnglish = language === "en";
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

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
  const eventDays = new Set(events.map((event) => format(parseUTC(event.time_button_click), "yyyy-MM-dd")));
  const weekStart = now ? startOfWeek(now, { weekStartsOn: 1 }) : null;
  const dayLabels = isEnglish ? ["M", "T", "W", "T", "F", "S", "S"] : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const weekDays = dayLabels.map((label, index) => {
    const date = weekStart ? addDays(weekStart, index) : null;
    const key = date ? format(date, "yyyy-MM-dd") : "";
    return {
      label,
      checked: Boolean(key && eventDays.has(key)),
      today: Boolean(date && now && format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd")),
      future: Boolean(date && now && date.getTime() > now.getTime()),
    };
  });
  const weeklyCheckins = weekDays.filter((day) => day.checked).length;
  const lastCheckTime = todayStatus?.last_click_at ? format(parseUTC(todayStatus.last_click_at), "HH:mm") : null;

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
    checked: "Đã điểm danh hôm nay",
    waiting: "Chưa điểm danh hôm nay",
    reassuring: "An tâm",
    pending: "Đang chờ",
    waitingHint: "Lumo đang chờ lần điểm danh hôm nay.",
    lastCheck: "Lần gần nhất",
    summary: "Tổng quan hôm nay",
    thisWeek: "Tuần này",
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
