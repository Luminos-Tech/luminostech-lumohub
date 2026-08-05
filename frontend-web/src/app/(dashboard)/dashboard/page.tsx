"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  BatteryMedium,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartPulse,
  ShieldCheck,
  Watch,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { useEventStore } from "@/store/eventStore";
import { parseUTC } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { devices, fetchDevices } = useDeviceStore();
  const { events: checkIns, todayStatus, fetchEvents: fetchCheckIns, fetchTodayStatus } = useEventButtonStore();
  const { events, fetchEvents } = useEventStore();
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));

  useEffect(() => {
    const now = new Date();
    fetchEvents(now, addMonths(now, 1));
    fetchCheckIns();
    fetchTodayStatus();
    fetchDevices();
  }, [fetchCheckIns, fetchDevices, fetchEvents, fetchTodayStatus]);

  const checkedDates = useMemo(
    () => checkIns.map((item) => parseUTC(item.time_button_click)),
    [checkIns],
  );

  const currentStreak = useMemo(() => {
    let streak = 0;
    let cursor = todayStatus?.clicked_today ? new Date() : subDays(new Date(), 1);
    while (checkedDates.some((date) => isSameDay(date, cursor))) {
      streak += 1;
      cursor = subDays(cursor, 1);
    }
    return streak;
  }, [checkedDates, todayStatus]);

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }),
  });

  const upcoming = events
    .filter((event) => parseUTC(event.start_time) >= new Date())
    .sort((a, b) => parseUTC(a.start_time).getTime() - parseUTC(b.start_time).getTime())
    .slice(0, 3);

  const firstName = user?.full_name?.trim().split(" ").pop() || "bạn";
  const activeDevice = devices.find((device) => device.is_active);
  const batteryLevel = activeDevice?.battery_level;

  return (
    <div className="lumo-page">
      <section className="lumo-welcome">
        <div>
          <p className="lumo-kicker">{format(new Date(), "EEEE, d 'tháng' M", { locale: vi })}</p>
          <h1>Chào {firstName},</h1>
          <p>Hôm nay mọi tín hiệu từ gia đình đều đang được theo dõi.</p>
        </div>
        <div className="lumo-safe-mark" aria-label="Hệ thống đang hoạt động">
          <ShieldCheck size={24} />
        </div>
      </section>

      <section className={`checkin-hero ${todayStatus?.clicked_today ? "is-checked" : ""}`}>
        <div className="checkin-orbit" aria-hidden="true">
          <span><Check size={28} strokeWidth={3} /></span>
        </div>
        <div className="checkin-copy">
          <p className="lumo-kicker">Điểm danh hôm nay</p>
          <h2>{todayStatus?.clicked_today ? "Đã nhận tín hiệu an tâm" : "Đang chờ điểm danh"}</h2>
          <p>
            {todayStatus?.last_click_at
              ? `Lần gần nhất lúc ${format(parseUTC(todayStatus.last_click_at), "HH:mm")}`
              : "Lumo sẽ báo ngay khi nhận được nhịp chạm đầu tiên."}
          </p>
        </div>
        <Link href="/settings/event-buttons" className="checkin-link" aria-label="Xem lịch sử điểm danh">
          <ChevronRight size={20} />
        </Link>
      </section>

      <section className="quick-metrics" aria-label="Tổng quan thiết bị">
        <div className="metric-panel">
          <span className="metric-icon coral"><HeartPulse size={20} /></span>
          <div><strong>{currentStreak}</strong><span>ngày liên tiếp</span></div>
        </div>
        <Link href="/settings/devices" className="metric-panel">
          <span className="metric-icon green"><BatteryMedium size={20} /></span>
          <div>
            <strong>{typeof batteryLevel === "number" ? `${batteryLevel}%` : "--"}</strong>
            <span>{typeof batteryLevel === "number" ? "pin vòng tay" : "chưa có dữ liệu pin"}</span>
          </div>
        </Link>
      </section>

      <section className="lumo-section calendar-section">
        <div className="section-heading">
          <div>
            <p className="lumo-kicker">Nhịp an tâm</p>
            <h2>Lịch điểm danh</h2>
          </div>
          <div className="month-switcher">
            <button onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
            <span>{format(visibleMonth, "MMMM yyyy", { locale: vi })}</span>
            <button onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} aria-label="Tháng sau"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="checkin-calendar">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span className="weekday" key={day}>{day}</span>)}
          {calendarDays.map((day) => {
            const checked = checkedDates.some((date) => isSameDay(date, day));
            return (
              <div className={`calendar-day ${!isSameMonth(day, visibleMonth) ? "muted" : ""} ${checked ? "checked" : ""} ${isSameDay(day, new Date()) ? "today" : ""}`} key={day.toISOString()}>
                <span>{format(day, "d")}</span>
                {checked && <i><Check size={10} strokeWidth={3} /></i>}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend"><span><i className="legend-dot checked" />Đã điểm danh</span><span><i className="legend-dot today" />Hôm nay</span></div>
      </section>

      <section className="lumo-section">
        <div className="section-heading">
          <div><p className="lumo-kicker">Sắp tới</p><h2>Lịch nhắc gần nhất</h2></div>
          <Link href="/calendar">Xem lịch</Link>
        </div>
        {upcoming.length > 0 ? (
          <div className="upcoming-list">
            {upcoming.map((event) => (
              <Link href={`/events/${event.id}`} className="upcoming-row" key={event.id}>
                <span className="event-date"><b>{format(parseUTC(event.start_time), "dd")}</b>{format(parseUTC(event.start_time), "MMM", { locale: vi })}</span>
                <span className="event-copy"><strong>{event.title}</strong><small><Clock3 size={13} />{format(parseUTC(event.start_time), "HH:mm")}{event.location ? ` · ${event.location}` : ""}</small></span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><CalendarDays size={24} /><span>Chưa có lịch nhắc sắp tới</span></div>
        )}
      </section>

      <section className="device-note">
        <Watch size={22} />
        <div><strong>{activeDevice ? `Lumo ${activeDevice.device_id}` : "Chưa liên kết thiết bị"}</strong><span>{activeDevice ? "Hub đang được bật theo dõi" : "Liên kết Hub và vòng tay để bắt đầu"}</span></div>
        <Link href="/settings/devices"><ChevronRight size={18} /></Link>
      </section>
    </div>
  );
}
