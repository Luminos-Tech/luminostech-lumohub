"use client";
import { useEffect, useState } from "react";
import { useEventButtonStore } from "@/store/eventButtonStore";
import type { EventButton } from "@/types";
import { format, isToday, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export default function EventButtonsPage() {
  const { events, todayStatus, loading, todayLoading, fetchEvents, fetchTodayStatus } =
    useEventButtonStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchEvents();
    fetchTodayStatus();
  }, [fetchEvents, fetchTodayStatus]);

  const eventsForDate = events.filter((e) =>
    isToday(parseISO(e.time_button_click))
  );

  const groupedByDate: Record<string, EventButton[]> = {};
  events.forEach((e) => {
    const key = format(parseISO(e.time_button_click), "yyyy-MM-dd");
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(e);
  });
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const stats = [
    {
      label: "Hôm nay",
      value: todayStatus?.total_today ?? 0,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Có click hôm nay",
      value: todayStatus?.clicked_today ? "Có" : "Chưa",
      icon: todayStatus?.clicked_today ? CheckCircle2 : XCircle,
      color: todayStatus?.clicked_today ? "text-green-600" : "text-gray-400",
      bg: todayStatus?.clicked_today ? "bg-green-50" : "bg-gray-50",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Nhật ký nút bấm</h1>
        <button
          onClick={() => { fetchEvents(); fetchTodayStatus(); }}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-semibold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's log */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Hôm nay</h2>
        </div>
        {todayLoading ? (
          <div className="p-8 text-center text-gray-400">Đang tải...</div>
        ) : eventsForDate.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Chưa có lần bấm nào hôm nay</div>
        ) : (
          <div className="divide-y">
            {eventsForDate.map((e) => (
              <div key={e.id} className="p-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-mono text-gray-600">
                  {format(parseISO(e.time_button_click), "HH:mm:ss")}
                </span>
                <span className="text-sm text-gray-500">Thiết bị #{e.device_code}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History by date */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Lịch sử</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Đang tải...</div>
        ) : sortedDates.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Chưa có lần bấm nào</div>
        ) : (
          <div className="divide-y">
            {sortedDates.slice(0, 30).map((date) => {
              const dayEvents = groupedByDate[date];
              return (
                <div key={date}>
                  <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: vi })}
                    </span>
                    <span className="text-xs text-gray-400">{dayEvents.length} lần</span>
                  </div>
                  {dayEvents.map((e) => (
                    <div key={e.id} className="px-4 py-2 flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-600">
                        {format(parseISO(e.time_button_click), "HH:mm:ss")}
                      </span>
                      <span className="text-sm text-gray-500">Thiết bị #{e.device_code}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
