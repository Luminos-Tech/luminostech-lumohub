import type { Notification } from "@/types";
import { format } from "date-fns";
import { Bell } from "lucide-react";

interface Props {
  notification: Notification;
  onClick?: () => void;
}

export default function NotificationItem({ notification: n, onClick }: Props) {
  return (
    <li
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-blue-50/40" : ""}`}
    >
      <div className={`p-2 rounded-full shrink-0 ${n.is_read ? "bg-gray-100 text-gray-400" : "bg-primary-100 text-primary-600"}`}>
        <Bell size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${n.is_read ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>
        <p className="text-xs text-gray-400 mt-1">{format(new Date(n.created_at), "HH:mm dd/MM/yyyy")}</p>
      </div>
      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />}
    </li>
  );
}
