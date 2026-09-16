"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Event } from "@/types";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Clock, Bell, Tag } from "lucide-react";
import Spinner from "@/components/common/Spinner";

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Event>(`/events/${id}`)
      .then((r) => setEvent(r.data))
      .catch(() => router.push("/events"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner /></div>;
  if (!event) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm" onClick={() => router.back()}>
        <ArrowLeft size={16} /> Quay lại
      </button>
      <div className="card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-4 h-4 rounded-full mt-1 shrink-0" style={{ backgroundColor: event.color || "#3b82f6" }} />
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        </div>
        {event.description && <p className="text-gray-600">{event.description}</p>}
        <div className="grid grid-cols-1 gap-3 pt-2">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Clock size={16} className="text-gray-400" />
            <span>{format(new Date(event.start_time), "HH:mm dd/MM/yyyy")} → {format(new Date(event.end_time), "HH:mm dd/MM/yyyy")}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <MapPin size={16} className="text-gray-400" /><span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Tag size={16} className="text-gray-400" />
            <span className={`badge ${event.priority === "high" ? "bg-red-100 text-red-700" : event.priority === "low" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>{event.priority}</span>
            <span className={`badge ${event.status === "completed" ? "bg-green-100 text-green-700" : event.status === "canceled" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>{event.status}</span>
          </div>
          {event.reminders?.length > 0 && (
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <Bell size={16} className="text-gray-400 mt-0.5" />
              <ul className="space-y-1">
                {event.reminders.map((r) => (
                  <li key={r.id}>{r.remind_before_minutes} phút trước · {r.channel}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
