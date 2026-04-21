"use client";
import { useEffect } from "react";
import { useEventStore } from "@/store/eventStore";
import { useAuthStore } from "@/store/authStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { format, startOfDay, endOfDay, addDays, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, Bell, CheckCircle, Clock, Activity, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { parseUTC } from "@/lib/utils";

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
    const s = parseUTC(e.start_time);
    const now = new Date();
    return s >= startOfDay(now) && s <= endOfDay(now);
  });

  const upcoming = events.filter((e) => {
    const s = parseUTC(e.start_time);
    const now = new Date();
    return s > endOfDay(now);
  }).slice(0, 5);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Xin chào, {user?.full_name?.split(" ").pop()} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: vi })}
          </p>
        </div>
        <Link
          href="/calendar"
          className="hidden sm:flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-semibold transition-colors"
        >
          Xem lịch <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Hôm nay", value: today.length, icon: Calendar, color: "text-primary-600", bg: "bg-primary-50", iconBg: "from-primary-500 to-primary-600" },
          { label: "7 ngày tới", value: upcoming.length, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", iconBg: "from-amber-500 to-orange-500" },
          { label: "Tổng sự kiện", value: events.length, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", iconBg: "from-emerald-500 to-green-600" },
          {
            label: "Nút bấm",
            value: todayStatus?.total_today ?? "–",
            icon: todayStatus?.clicked_today ? CheckCircle2 : XCircle,
            color: todayStatus?.clicked_today ? "text-emerald-600" : "text-gray-400",
            bg: todayStatus?.clicked_today ? "bg-emerald-50" : "bg-gray-50",
            iconBg: todayStatus?.clicked_today ? "from-emerald-500 to-green-600" : "from-gray-400 to-gray-500",
            sub: todayStatus?.clicked_today ? "Đã bấm hôm nay" : "Chưa bấm hôm nay",
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
            <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${stat.iconBg} shadow-sm`}>
              <stat.icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{stat.label}</p>
              {"sub" in stat && stat.sub && (
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{stat.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today's events */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-primary-500 rounded-full" />
            Lịch hôm nay
          </h2>
          <Link href="/calendar" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 transition-colors">
            Xem tất cả <ArrowRight size={12} />
          </Link>
        </div>
        {today.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-gray-400 text-sm">Hôm nay không có sự kiện nào 🎉</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {today.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <span
                  className="w-3 h-3 rounded-full mt-1.5 shrink-0 shadow-sm"
                  style={{ backgroundColor: ev.color || "#dc2626" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary-700 transition-colors">{ev.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(parseUTC(ev.start_time), "HH:mm")} – {format(parseUTC(ev.end_time), "HH:mm")}
                    {ev.location && ` · ${ev.location}`}
                  </p>
                </div>
                <span className={`badge text-[10px] ${ev.priority === "high" ? "bg-red-100 text-red-700" :
                  ev.priority === "low" ? "bg-gray-100 text-gray-500" :
                    "bg-primary-50 text-primary-700"
                  }`}>{ev.priority}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="card p-5 sm:p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-amber-400 rounded-full" />
            Sắp tới
          </h2>
          <ul className="space-y-2">
            {upcoming.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ev.color || "#dc2626" }}
                />
                <span className="flex-1 text-gray-800 truncate font-medium">{ev.title}</span>
                <span className="text-gray-400 text-xs whitespace-nowrap font-medium">
                  {format(parseUTC(ev.start_time), "dd/MM HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
