"use client";
import Modal from "@/components/common/Modal";
import type { Event } from "@/types";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { MapPin, Clock, Bell, Tag, Pencil, Trash2 } from "lucide-react";
import { useEventStore } from "@/store/eventStore";

interface Props {
  event: Event;
  onClose: () => void;
  onEdit: (event: Event) => void;
}

const priorityLabel: Record<string, string> = { low: "Thấp", normal: "Bình thường", high: "Cao" };
const statusLabel: Record<string, string> = { scheduled: "Đã lên lịch", completed: "Hoàn thành", canceled: "Đã hủy" };

export default function EventDetailModal({ event, onClose, onEdit }: Props) {
  const { deleteEvent } = useEventStore();

  const handleDelete = async () => {
    if (confirm("Xóa sự kiện này?")) {
      await deleteEvent(event.id);
      onClose();
    }
  };

  return (
    <Modal open title="Chi tiết sự kiện" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-4 h-4 rounded-full mt-1 shrink-0" style={{ backgroundColor: event.color || "#3b82f6" }} />
          <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
        </div>

        {event.description && <p className="text-gray-600 text-sm">{event.description}</p>}

        <div className="space-y-2.5 text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-gray-400 shrink-0" />
            <span>
              {format(new Date(event.start_time), "HH:mm - EEEE, dd/MM/yyyy", { locale: vi })}
              {" → "}
              {format(new Date(event.end_time), "HH:mm dd/MM/yyyy")}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-gray-400 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Tag size={16} className="text-gray-400 shrink-0" />
            <span
              className={`badge text-xs ${event.priority === "high" ? "bg-red-100 text-red-700" : event.priority === "low" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}>
              {priorityLabel[event.priority]}
            </span>
            <span className={`badge text-xs ${event.status === "completed" ? "bg-green-100 text-green-700" : event.status === "canceled" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>
              {statusLabel[event.status]}
            </span>
          </div>
          {event.reminders?.length > 0 && (
            <div className="flex items-start gap-3">
              <Bell size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <ul className="space-y-0.5">
                {event.reminders.map((r) => (
                  <li key={r.id} className="text-xs text-gray-500">
                    {r.remind_before_minutes} phút trước · {r.channel}
                    {r.is_sent && <span className="ml-1 text-green-500">✓ Đã gửi</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2 border-t border-gray-100">
          <button onClick={handleDelete} className="btn-danger text-sm">
            <Trash2 size={14} /> Xóa
          </button>
          <button onClick={() => onEdit(event)} className="btn-primary text-sm">
            <Pencil size={14} /> Chỉnh sửa
          </button>
        </div>
      </div>
    </Modal>
  );
}
