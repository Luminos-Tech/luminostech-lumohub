"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { useEventStore } from "@/store/eventStore";
import { useEffect, useState, useRef, useMemo } from "react";
import type { Event } from "@/types";
import EventFormModal from "./EventFormModal";
import EventDetailModal from "./EventDetailModal";
import { format, startOfDay, endOfDay, addDays, isToday, isTomorrow, isFuture } from "date-fns";
import { vi } from "date-fns/locale";
import { Plus, Search, SlidersHorizontal, Calendar, CalendarDays, Clock, ChevronRight, X, Sparkles } from "lucide-react";
import { cn, parseUTC } from "@/lib/utils";
import AIImportModal from "./AIImportModal";

const PRIORITY_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "high", label: "Cao", color: "bg-red-100 text-red-700" },
  { value: "normal", label: "Thường", color: "bg-blue-100 text-blue-700" },
  { value: "low", label: "Thấp", color: "bg-gray-100 text-gray-600" },
];

function getTimeLabel(dateStr: string) {
  const d = parseUTC(dateStr);
  if (isToday(d)) return "Hôm nay";
  if (isTomorrow(d)) return "Ngày mai";
  return format(d, "EEE dd/MM", { locale: vi });
}

function UpcomingPanel({
  events,
  onEventClick,
}: {
  events: Event[];
  onEventClick: (ev: Event) => void;
}) {
  const now = new Date();
  const in2Days = endOfDay(addDays(now, 2));

  const todayEvents = events.filter((e) => {
    const s = parseUTC(e.start_time);
    return s >= startOfDay(now) && s <= endOfDay(now);
  });

  // Tomorrow and day after tomorrow
  const next2Events = events.filter((e) => {
    const s = parseUTC(e.start_time);
    return s > endOfDay(now) && s <= in2Days;
  });

  // Beyond 2 days
  const laterEvents = events
    .filter((e) => parseUTC(e.start_time) > in2Days)
    .slice(0, 6);

  const EventItem = ({ ev, defaultColor = "#3b82f6" }: { ev: Event; defaultColor?: string }) => (
    <li
      key={ev.id}
      onClick={() => onEventClick(ev)}
      className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
    >
      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.color || defaultColor }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-800 truncate group-hover:text-primary-700 transition-colors">{ev.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {getTimeLabel(ev.start_time)} · {format(parseUTC(ev.start_time), "HH:mm")}
        </p>
      </div>
      <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-400 mt-1 shrink-0 transition-colors" />
    </li>
  );

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto no-scrollbar">
      {/* Hôm nay */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Calendar size={12} />
          Hôm nay ({todayEvents.length})
        </h3>
        {todayEvents.length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-1">Không có lịch hôm nay 🎉</p>
        ) : (
          <ul className="space-y-1">
            {todayEvents.map((ev) => (
              <li
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group transition-colors"
              >
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate group-hover:text-primary-700 transition-colors">{ev.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {format(parseUTC(ev.start_time), "HH:mm")} – {format(parseUTC(ev.end_time), "HH:mm")}
                  </p>
                </div>
                <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-400 mt-1 shrink-0 transition-colors" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 2 ngày tới */}
      <div>
        <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Clock size={12} />
          2 ngày tới ({next2Events.length})
        </h3>
        {next2Events.length === 0 ? (
          <p className="text-xs text-gray-400 italic pl-1">Không có lịch 2 ngày tới</p>
        ) : (
          <ul className="space-y-1">
            {next2Events.map((ev) => <EventItem key={ev.id} ev={ev} defaultColor="#f97316" />)}
          </ul>
        )}
      </div>

      {/* Sắp tới */}
      {laterEvents.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CalendarDays size={12} />
            Sắp tới
          </h3>
          <ul className="space-y-1">
            {laterEvents.map((ev) => <EventItem key={ev.id} ev={ev} defaultColor="#6366f1" />)}
          </ul>
        </div>
      )}
    </div>
  );
}


export default function CalendarView() {
  const { events, loading, fetchEvents } = useEventStore();
  const [showForm, setShowForm] = useState(false);
  const [defaultDate, setDefaultDate] = useState<{ start: string; end: string } | null>(null);
  const [viewing, setViewing] = useState<Event | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [duplicating, setDuplicating] = useState<Event | null>(null);
  const [showAIImport, setShowAIImport] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  // Start with null — only set after client mounts so we know the real window size
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    fetchEvents();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchSearch =
        !search ||
        ev.title.toLowerCase().includes(search.toLowerCase()) ||
        ev.location?.toLowerCase().includes(search.toLowerCase()) ||
        ev.description?.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || ev.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [events, search, priorityFilter]);

  const fcEvents = filteredEvents.map((ev) => ({
    id: String(ev.id),
    title: ev.title,
    start: parseUTC(ev.start_time).toISOString(),
    end: parseUTC(ev.end_time).toISOString(),
    backgroundColor: ev.color || "#3b82f6",
    borderColor: "transparent",
    extendedProps: { event: ev },
  }));

  const openCreate = () => {
    setDefaultDate(null);
    setEditing(null);
    setShowForm(true);
  };

  // Don't render FullCalendar until we know the device type
  if (isMobile === null) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm sự kiện..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shrink-0",
            showFilters || priorityFilter !== "all"
              ? "bg-primary-50 border-primary-200 text-primary-700"
              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
          )}
          title="Bộ lọc"
        >
          <SlidersHorizontal size={15} />
          {priorityFilter !== "all" && (
            <span className="absolute w-1.5 h-1.5 rounded-full bg-primary-500 translate-x-2 -translate-y-2" />
          )}
        </button>

        {/* AI Import button */}
        <button
          onClick={() => setShowAIImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0"
          title="Nhập lịch bằng AI"
        >
          <Sparkles size={15} />
          <span className="hidden sm:inline">AI Import</span>
        </button>

        {/* Create button */}
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Tạo sự kiện</span>
          <span className="sm:hidden">Tạo</span>
        </button>
      </div>

      {/* Priority filter pills */}
      {showFilters && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                priorityFilter === opt.value
                  ? opt.value === "all"
                    ? "bg-gray-800 text-white border-gray-800"
                    : (opt.color || "") + " border-transparent shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {opt.label}
            </button>
          ))}
          {priorityFilter !== "all" && (
            <button onClick={() => setPriorityFilter("all")} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              <X size={11} /> Xoá
            </button>
          )}
        </div>
      )}

      {/* ── Main: Calendar + Side panel ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calendar — key forces re-mount when device type changes */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <FullCalendar
            key={isMobile ? "mobile" : "desktop"}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={isMobile ? "listWeek" : "dayGridMonth"}
            locale="vi"
            headerToolbar={
              isMobile
                ? {
                    left: "prev,next",
                    center: "title",
                    right: "today",
                  }
                : {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                  }
            }
            footerToolbar={
              isMobile
                ? { center: "listWeek,timeGridDay,dayGridMonth" }
                : false
            }
            buttonText={{
              today: "Hôm nay",
              month: "Tháng",
              week: "Tuần",
              day: "Ngày",
              list: "Danh sách",
              listWeek: "Tuần",
              listDay: "Ngày",
              listMonth: "Tháng",
            }}
            events={fcEvents}
            height="100%"
            selectable
            editable={false}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={false}
            nowIndicator
            dayMaxEvents={isMobile ? 2 : 3}
            eventDisplay="block"
            select={(info) => {
              setDefaultDate({ start: info.startStr, end: info.endStr });
              setEditing(null);
              setShowForm(true);
            }}
            eventClick={(info) => {
              const ev = info.event.extendedProps.event as Event;
              setViewing(ev);
            }}
            noEventsContent={
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Calendar size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Không có sự kiện nào</p>
                {(search || priorityFilter !== "all") && (
                  <p className="text-xs mt-1 text-gray-300">Thử thay đổi bộ lọc</p>
                )}
              </div>
            }
          />
        </div>

        {/* Upcoming side panel — desktop only */}
        <div className="hidden lg:flex flex-col w-56 xl:w-64 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-y-auto shrink-0">
          <UpcomingPanel events={events} onEventClick={(ev) => setViewing(ev)} />
        </div>
      </div>

      {/* Quick stats— desktop only */}
      <div className="hidden sm:flex items-center gap-3 mt-2.5 text-xs text-gray-400">
        <span>{events.length} sự kiện tổng</span>
        <span>·</span>
        <span>{events.filter((e) => isToday(new Date(e.start_time))).length} hôm nay</span>
        <span>·</span>
        <span>
          {events.filter((e) => {
            const s = new Date(e.start_time);
            return isFuture(s) && s <= addDays(new Date(), 7);
          }).length}{" "}
          trong 7 ngày tới
        </span>
        {(search || priorityFilter !== "all") && (
          <>
            <span>·</span>
            <span className="text-primary-500 font-medium">Đang lọc: {filteredEvents.length} kết quả</span>
          </>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <EventFormModal
          event={editing}
          prefillFrom={duplicating}
          defaultStart={defaultDate?.start}
          defaultEnd={defaultDate?.end}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setDuplicating(null);
            setDefaultDate(null);
          }}
        />
      )}
      {viewing && (
        <EventDetailModal
          event={viewing}
          onClose={() => setViewing(null)}
          onEdit={(ev) => { setViewing(null); setEditing(ev); setShowForm(true); }}
          onDuplicate={(ev) => { setDuplicating(ev); setShowForm(true); }}
        />
      )}
      {showAIImport && (
        <AIImportModal
          onClose={() => setShowAIImport(false)}
          onCreated={() => fetchEvents()}
        />
      )}
    </div>
  );
}
