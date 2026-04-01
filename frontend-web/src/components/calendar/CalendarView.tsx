"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { useEventStore } from "@/store/eventStore";
import { useEffect, useState } from "react";
import type { Event } from "@/types";
import EventFormModal from "./EventFormModal";
import EventDetailModal from "./EventDetailModal";

export default function CalendarView() {
  const { events, fetchEvents } = useEventStore();
  const [showForm, setShowForm] = useState(false);
  const [defaultDate, setDefaultDate] = useState<{ start: string; end: string } | null>(null);
  const [viewing, setViewing] = useState<Event | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fcEvents = events.map((ev) => ({
    id: String(ev.id),
    title: ev.title,
    start: ev.start_time,
    end: ev.end_time,
    backgroundColor: ev.color || "#3b82f6",
    borderColor: "transparent",
    extendedProps: { event: ev },
  }));

  return (
    <div className="card p-4 h-[calc(100vh-160px)]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        locale="vi"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
        }}
        buttonText={{ today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày", list: "Danh sách" }}
        events={fcEvents}
        height="100%"
        selectable
        editable={false}
        select={(info) => {
          setDefaultDate({ start: info.startStr, end: info.endStr });
          setShowForm(true);
        }}
        eventClick={(info) => {
          const ev = info.event.extendedProps.event as Event;
          setViewing(ev);
        }}
      />

      {showForm && (
        <EventFormModal
          event={editing}
          defaultStart={defaultDate?.start}
          defaultEnd={defaultDate?.end}
          onClose={() => { setShowForm(false); setEditing(null); setDefaultDate(null); }}
        />
      )}

      {viewing && (
        <EventDetailModal
          event={viewing}
          onClose={() => setViewing(null)}
          onEdit={(ev) => { setViewing(null); setEditing(ev); setShowForm(true); }}
        />
      )}
    </div>
  );
}
