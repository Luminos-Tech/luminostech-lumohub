"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, HeartHandshake, MessageCircleHeart, Pill, Sunrise } from "lucide-react";
import { usePreferenceStore } from "@/store/preferenceStore";

type ReminderKey = "greeting" | "medicine" | "checkin" | "care";
type ReminderTimes = Record<ReminderKey, string>;
type ReminderEnabled = Record<ReminderKey, boolean>;

const STORAGE_KEY = "lumohub-reminder-schedule";
const DEFAULT_TIMES: ReminderTimes = {
  greeting: "07:30",
  medicine: "09:00",
  checkin: "08:00",
  care: "19:30",
};
const DEFAULT_ENABLED: ReminderEnabled = {
  greeting: true,
  medicine: true,
  checkin: true,
  care: true,
};
const CHECKIN_TIMES = ["08:00", "12:00", "24:00"];

const reminderMeta = {
  greeting: { icon: Sunrise, tone: "sun" },
  medicine: { icon: Pill, tone: "medicine" },
  checkin: { icon: BellRing, tone: "checkin" },
  care: { icon: MessageCircleHeart, tone: "care" },
} as const;

function minutesOf(time: string) {
  if (time === "24:00") return 24 * 60;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function ReminderSchedule() {
  const isEnglish = usePreferenceStore((state) => state.language === "en");
  const [times, setTimes] = useState<ReminderTimes>(DEFAULT_TIMES);
  const [enabled, setEnabled] = useState<ReminderEnabled>(DEFAULT_ENABLED);
  const [hydrated, setHydrated] = useState(false);

  const copy = isEnglish ? {
    title: "Lumo reminders",
    subtitle: "Daily care schedule",
    next: "Next reminder",
    today: "Today",
    checkinTitle: "Check-in reminder",
    checkinScheduleHint: "Choose when the Hub should request a daily check-in.",
    timeline: "Daily schedule",
    active: "Active",
    paused: "Paused",
    saved: "Saved on this device",
    greeting: "Morning greeting",
    greetingHint: "Start the day with a familiar voice",
    medicine: "Medicine reminder",
    medicineHint: "Play the recorded medicine message",
    checkin: "Check-in",
    checkinHint: "Ask for the daily button check-in",
    care: "Care message",
    careHint: "A gentle family check-in",
  } : {
    title: "Lịch nhắc Lumo",
    subtitle: "Nhịp chăm sóc trong ngày",
    next: "Lời nhắc tiếp theo",
    today: "Hôm nay",
    checkinTitle: "Nhắc điểm danh",
    checkinScheduleHint: "Chọn thời điểm Hub nhắc người thân điểm danh mỗi ngày.",
    timeline: "Lịch trong ngày",
    active: "Đang bật",
    paused: "Tạm dừng",
    saved: "Đã lưu trên thiết bị",
    greeting: "Lời chào buổi sáng",
    greetingHint: "Bắt đầu ngày mới bằng giọng nói thân quen",
    medicine: "Nhắc uống thuốc",
    medicineHint: "Phát lời nhắc thuốc đã ghi âm",
    checkin: "Điểm danh",
    checkinHint: "Nhắc người thân bấm nút điểm danh",
    care: "Lời hỏi thăm",
    careHint: "Gửi một lời quan tâm nhẹ nhàng",
  };

  const labels: Record<ReminderKey, { title: string; hint: string }> = {
    greeting: { title: copy.greeting, hint: copy.greetingHint },
    medicine: { title: copy.medicine, hint: copy.medicineHint },
    checkin: { title: copy.checkin, hint: copy.checkinHint },
    care: { title: copy.care, hint: copy.careHint },
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { times?: Partial<ReminderTimes>; enabled?: Partial<ReminderEnabled> };
        setTimes({ ...DEFAULT_TIMES, ...parsed.times });
        setEnabled({ ...DEFAULT_ENABLED, ...parsed.enabled });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ times, enabled }));
  }, [enabled, hydrated, times]);

  const orderedReminders = useMemo(() => (
    (Object.keys(reminderMeta) as ReminderKey[])
      .filter((key) => enabled[key])
      .sort((a, b) => minutesOf(times[a]) - minutesOf(times[b]))
  ), [enabled, times]);

  const nextReminder = useMemo(() => {
    if (!hydrated) return undefined;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = orderedReminders.find((key) => minutesOf(times[key]) >= currentMinutes);
    return upcoming ?? orderedReminders[0];
  }, [hydrated, orderedReminders, times]);

  const updateTime = (key: ReminderKey, value: string) => setTimes((current) => ({ ...current, [key]: value }));
  const toggleReminder = (key: ReminderKey) => setEnabled((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="reminder-page">
      <header className="reminder-heading">
        <div><span>{copy.today}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
        <span className="reminder-heading-icon"><HeartHandshake size={25} /></span>
      </header>

      <section className="next-reminder-card" aria-label={copy.next}>
        <span className="next-reminder-icon"><BellRing size={24} /></span>
        <div>
          <small>{copy.next}</small>
          <strong>{nextReminder ? labels[nextReminder].title : "--"}</strong>
        </div>
        <time>{nextReminder ? times[nextReminder] : "--:--"}</time>
      </section>

      <section className="reminder-section checkin-schedule">
        <div className="reminder-section-heading">
          <span className="reminder-section-icon checkin"><BellRing size={21} /></span>
          <div><h2>{copy.checkinTitle}</h2><p>{copy.checkinScheduleHint}</p></div>
          <button type="button" className={`schedule-switch ${enabled.checkin ? "on" : ""}`} aria-pressed={enabled.checkin} aria-label={enabled.checkin ? copy.active : copy.paused} onClick={() => toggleReminder("checkin")}><span /></button>
        </div>
        <div className="checkin-time-options" role="group" aria-label={copy.checkinTitle}>
          {CHECKIN_TIMES.map((time) => (
            <button type="button" key={time} className={times.checkin === time ? "active" : ""} disabled={!enabled.checkin} onClick={() => updateTime("checkin", time)}>
              <span>{time}</span>{times.checkin === time && <Check size={16} />}
            </button>
          ))}
        </div>
      </section>

      <section className="reminder-section daily-schedule">
        <div className="daily-schedule-title"><div><h2>{copy.timeline}</h2><span><Check size={14} />{copy.saved}</span></div></div>
        <div className="reminder-timeline">
          {(Object.keys(reminderMeta) as ReminderKey[]).map((key) => {
            const meta = reminderMeta[key];
            const Icon = meta.icon;
            const usesPreset = key === "checkin";
            return (
              <article className={`reminder-row ${enabled[key] ? "" : "disabled"}`} key={key}>
                <span className={`reminder-row-icon ${meta.tone}`}><Icon size={20} /></span>
                <div className="reminder-row-copy"><strong>{labels[key].title}</strong><small>{labels[key].hint}</small></div>
                {usesPreset ? <span className="reminder-time-static">{times[key]}</span> : <input type="time" value={times[key]} disabled={!enabled[key]} aria-label={labels[key].title} onChange={(event) => updateTime(key, event.target.value)} />}
                <button type="button" className={`schedule-switch compact ${enabled[key] ? "on" : ""}`} aria-pressed={enabled[key]} aria-label={enabled[key] ? copy.active : copy.paused} onClick={() => toggleReminder(key)}><span /></button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
