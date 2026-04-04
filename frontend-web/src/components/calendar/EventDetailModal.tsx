"use client";
import Modal from "@/components/common/Modal";
import type { Event } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MapPin, Clock, Bell, Tag, Pencil, Trash2, Copy } from "lucide-react";
import { useEventStore } from "@/store/eventStore";
import { parseUTC } from "@/lib/utils";

interface Props {
  event: Event;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onDuplicate: (event: Event) => void;
}

const priorityLabel: Record<string, string> = { low: "Thấp", normal: "Bình thường", high: "Cao" };
const priorityClass: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};
const statusLabel: Record<string, string> = { scheduled: "Đã lên lịch", completed: "Hoàn thành", canceled: "Đã hủy" };
const statusClass: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  canceled: "bg-gray-100 text-gray-500",
  scheduled: "bg-yellow-100 text-yellow-700",
};

export default function EventDetailModal({ event, onClose, onEdit, onDuplicate }: Props) {
  const { deleteEvent } = useEventStore();

  const handleDelete = async () => {
    if (confirm("Xóa sự kiện này?")) {
      await deleteEvent(event.id);
      onClose();
    }
  };

  const eventColor = event.color || "#3b82f6";
  const startDate = parseUTC(event.start_time);
  const endDate = parseUTC(event.end_time);
  const isUpcoming = startDate > new Date();
  const timeFromNow = formatDistanceToNow(startDate, { locale: vi, addSuffix: true });

  return (
    <Modal open title="" onClose={onClose}>
      {/* Colored header */}
      <div
        className="rounded-xl p-4 mb-4 -mx-1"
        style={{ backgroundColor: eventColor + "18", borderLeft: `4px solid ${eventColor}` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: eventColor }} />
          <h3 className="text-lg font-semibold text-gray-900 leading-tight">{event.title}</h3>
        </div>
        <p className="text-xs text-gray-500 pl-5">
          {isUpcoming ? `Còn ${timeFromNow}` : `${timeFromNow}`}
        </p>
      </div>

      <div className="space-y-3.5 text-sm text-gray-600">
        {/* Time */}
        <div className="flex items-start gap-3">
          <Clock size={16} className="text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-800">
              {format(startDate, "EEEE, dd MMMM yyyy", { locale: vi })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(startDate, "HH:mm")} → {format(endDate, "HH:mm")}
              {" "}
              ({Math.round((endDate.getTime() - startDate.getTime()) / 60000)} phút)
            </p>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-gray-400 shrink-0" />
            <span>{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 leading-relaxed">
            {event.description}
          </div>
        )}

        {/* Priority & Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tag size={16} className="text-gray-400 shrink-0" />
          <span className={`badge text-xs ${priorityClass[event.priority]}`}>
            {priorityLabel[event.priority]}
          </span>
          <span className={`badge text-xs ${statusClass[event.status]}`}>
            {statusLabel[event.status]}
          </span>
        </div>

        {/* Reminders */}
        {event.reminders?.length > 0 && (
          <div className="flex items-start gap-3">
            <Bell size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <ul className="space-y-0.5">
              {event.reminders.map((r) => (
                <li key={r.id} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span>{r.remind_before_minutes} phút trước · {r.channel}</span>
                  {r.is_sent && (
                    <span className="text-green-500 font-medium">✓ Đã gửi</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="btn-danger text-sm">
            <Trash2 size={14} /> Xóa
          </button>
          <button
            onClick={() => { onClose(); onDuplicate(event); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Copy size={14} /> Nhân bản
          </button>
        </div>
        <button onClick={() => onEdit(event)} className="btn-primary text-sm">
          <Pencil size={14} /> Chỉnh sửa
        </button>
      </div>
    </Modal>
  );
}
