import type { Notification } from "@/types";
import { format } from "date-fns";
import { Bell, AlertTriangle } from "lucide-react";

interface Props {
  notification: Notification;
  onClick?: () => void;
}

export default function NotificationItem({ notification: n, onClick }: Props) {
  const isAlert = (n.notification_type ?? "normal") === "alert";
  const Icon = isAlert ? AlertTriangle : Bell;
  const iconBg = isAlert
    ? n.is_read ? "bg-orange-100 text-orange-400" : "bg-orange-500 text-white"
    : n.is_read ? "bg-gray-100 text-gray-400" : "bg-primary-100 text-primary-600";

  return (
    <li
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-blue-50/40" : ""}`}
    >
      <div className={`p-2 rounded-full shrink-0 ${iconBg}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${n.is_read ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>
        <p className="text-xs text-gray-400 mt-1">{format(new Date(n.created_at), "HH:mm dd/MM/yyyy")}</p>
      </div>
      {!n.is_read && <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isAlert ? "bg-orange-500" : "bg-primary-500"}`} />}
    </li>
  );
}
