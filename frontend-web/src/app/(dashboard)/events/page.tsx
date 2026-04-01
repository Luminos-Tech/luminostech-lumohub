"use client";
import { useEffect, useState } from "react";
import { useEventStore } from "@/store/eventStore";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, MapPin, Clock } from "lucide-react";
import EventFormModal from "@/components/calendar/EventFormModal";
import EventDetailModal from "@/components/calendar/EventDetailModal";
import type { Event } from "@/types";

export default function EventsPage() {
  const { events, fetchEvents, deleteEvent } = useEventStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [viewing, setViewing] = useState<Event | null>(null);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleDelete = async (id: number) => {
    if (confirm("Xóa sự kiện này?")) await deleteEvent(id);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tất cả sự kiện</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tạo sự kiện
        </button>
      </div>

      {events.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400">Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên!</p>
          <button className="btn-primary mt-4" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Tạo ngay
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
              <span className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewing(ev)}>
                <p className="font-semibold text-gray-900">{ev.title}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {format(new Date(ev.start_time), "HH:mm dd/MM/yyyy")} – {format(new Date(ev.end_time), "HH:mm dd/MM/yyyy")}
                  </span>
                  {ev.location && <span className="flex items-center gap-1"><MapPin size={12} />{ev.location}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600"
                  onClick={() => { setEditing(ev); setShowForm(true); }}>
                  <Pencil size={15} />
                </button>
                <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                  onClick={() => handleDelete(ev.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <EventFormModal
          event={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
      {viewing && <EventDetailModal event={viewing} onClose={() => setViewing(null)} onEdit={(ev) => { setViewing(null); setEditing(ev); setShowForm(true); }} />}
    </div>
  );
}
