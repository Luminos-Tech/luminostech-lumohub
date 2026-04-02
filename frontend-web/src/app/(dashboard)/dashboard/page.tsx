"use client";
import { useEffect } from "react";
import { useEventStore } from "@/store/eventStore";
import { useAuthStore } from "@/store/authStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { format, startOfDay, endOfDay, addDays, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, Bell, CheckCircle, Clock, Activity, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const { todayStatus, fetchTodayStatus } = useEventButtonStore();

  useEffect(() => {
    const now = new Date();
    fetchEvents(startOfDay(now), endOfDay(addDays(now, 7)));
    fetchTodayStatus();
  }, [fetchEvents, fetchTodayStatus]);

  const today = events.filter((e) => {
    const s = new Date(e.start_time);
    const now = new Date();
    return s >= startOfDay(now) && s <= endOfDay(now);
  });

  const upcoming = events.filter((e) => {
    const s = new Date(e.start_time);
    const now = new Date();
    return s > endOfDay(now);
  }).slice(0, 5);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Xin chào, {user?.full_name?.split(" ").pop()} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), "EEEE, dd MMMM yyyy", { locale: vi })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Hôm nay", value: today.length, icon: Calendar, color: "text-primary-600 bg-primary-50" },
          { label: "Sắp tới (7 ngày)", value: upcoming.length, icon: Clock, color: "text-lumo bg-indigo-50" },
          { label: "Tổng sự kiện", value: events.length, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          {
            label: "Nút bấm hôm nay",
            value: todayStatus?.total_today ?? "–",
            icon: todayStatus?.clicked_today ? CheckCircle2 : XCircle,
            color: todayStatus?.clicked_today ? "text-emerald-600 bg-emerald-50" : "text-gray-400 bg-gray-100",
            sub: todayStatus?.clicked_today ? "Đã bấm hôm nay" : "Chưa bấm hôm nay",
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.color}`}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
              {"sub" in stat && stat.sub && (
                <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today's events */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Lịch hôm nay</h2>
          <Link href="/calendar" className="text-sm text-primary-600 hover:underline">Xem lịch →</Link>
        </div>
        {today.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">Hôm nay không có sự kiện nào.</p>
        ) : (
          <ul className="space-y-3">
            {today.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                <span
                  className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: ev.color || "#3b82f6" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{ev.title}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(ev.start_time), "HH:mm")} – {format(new Date(ev.end_time), "HH:mm")}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                </div>
                <span className={`badge text-xs ${
                  ev.priority === "high" ? "bg-red-100 text-red-700" :
                  ev.priority === "low"  ? "bg-gray-100 text-gray-600" :
                  "bg-blue-100 text-blue-700"
                }`}>{ev.priority}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Sắp tới</h2>
          <ul className="space-y-3">
            {upcoming.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ev.color || "#6366f1" }}
                />
                <span className="flex-1 text-gray-800 truncate">{ev.title}</span>
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {format(new Date(ev.start_time), "dd/MM HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
