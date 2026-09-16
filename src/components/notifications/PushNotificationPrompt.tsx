"use client";
/**
 * PushNotificationPrompt
 * Hiển thị nút/luồng rõ ràng để bật thông báo Push
 * Quản lý 4 trạng thái: default | granted | denied | unsupported
 */
import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  initPushNotifications,
} from "@/lib/push-notification";

export type NotificationStatus = "default" | "granted" | "denied" | "unsupported";

/**
 * Hook để lấy trạng thái notification hiện tại
 */
export function useNotificationStatus(): [NotificationStatus, () => void] {
  const [status, setStatus] = useState<NotificationStatus>("default");

  const refresh = () => {
    setStatus(getNotificationPermission());
  };

  useEffect(() => {
    refresh();
  }, []);

  return [status, refresh];
}

/**
 * Prompt dạng banner — hiển thị ở đầu trang, cho phép tắt
 * Dùng khi user chưa quyết định (status = "default")
 */
export function PushBanner() {
  const [status, refreshStatus] = useNotificationStatus();
  const [dismissed, setDismissed] = useState(false);

  if (status !== "default" || dismissed) return null;

  return <PushBannerInner onStatusChange={refreshStatus} onDismiss={() => setDismissed(true)} />;
}

function PushBannerInner({ onStatusChange, onDismiss }: { onStatusChange: () => void; onDismiss: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        // Thử đăng ký push
        try {
          const result = await initPushNotifications();
          if (result.success) {
            toast.success("Đã bật thông báo thành công!");
          } else {
            // Quyền được rồi nhưng push chưa hoạt động (chưa có VAPID key)
            toast.success("Đã bật quyền thông báo! (Push server đang chờ cấu hình)");
          }
        } catch (err) {
          console.error("[Push] initPushNotifications error:", err);
          toast.success("Đã bật quyền thông báo!");
        }
      } else {
        toast.error("Bạn đã từ chối quyền thông báo");
      }
      // Refresh status so the banner hides
      onStatusChange();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 flex items-center justify-between gap-3 safe-area-inset-top shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Bell size={18} className="shrink-0 animate-pulse" />
        <p className="text-sm font-medium truncate">
          Bật thông báo để nhận lời nhắc lịch
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-lg text-xs font-semibold transition-all active:scale-95"
        >
          {loading ? "..." : "Bật ngay"}
        </button>
        <button
          onClick={onDismiss}
          className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-xs transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Card cài đặt thông báo — dùng trong trang Settings
 * Hiển thị trạng thái + hướng dẫn rõ ràng
 */
export function NotificationSettingCard() {
  const [status, refreshStatus] = useNotificationStatus();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (status === "denied") {
      // Người dùng đã từ chối → không thể bật lại bằng code
      toast.error("Đã từ chối trước đó. Vui lòng bật lại trong cài đặt trình duyệt/thiết bị.");
      return;
    }
    if (status === "granted") {
      toast.info("Thông báo đã được bật!");
      return;
    }
    if (status === "unsupported") {
      toast.error("Thiết bị/trình duyệt không hỗ trợ thông báo.");
      return;
    }

    setLoading(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        try {
          const result = await initPushNotifications();
          if (result.success) {
            toast.success("Đã bật thông báo thành công!");
          } else {
            toast.success("Quyền thông báo đã được bật!");
          }
        } catch (err) {
          console.error("[Push] initPushNotifications error:", err);
          toast.success("Quyền thông báo đã được bật!");
        }
      } else {
        toast.error("Bạn đã từ chối. Có thể bật lại trong cài đặt trình duyệt.");
      }
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    default: {
      icon: Bell,
      color: "text-gray-500",
      bg: "bg-gray-50",
      border: "border-gray-200",
      label: "Chưa bật",
      desc: "Bấm để bật thông báo",
      buttonText: "Bật thông báo",
      buttonColor: "bg-primary-600 hover:bg-primary-700 text-white",
    },
    granted: {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      label: "Đã bật",
      desc: "Bạn sẽ nhận được thông báo từ Lumo",
      buttonText: "Đã bật",
      buttonColor: "bg-green-100 text-green-700 cursor-default",
    },
    denied: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Bị từ chối",
      desc: "Cần bật lại trong cài đặt trình duyệt",
      buttonText: "Xem hướng dẫn",
      buttonColor: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    unsupported: {
      icon: Smartphone,
      color: "text-gray-400",
      bg: "bg-gray-50",
      border: "border-gray-200",
      label: "Không hỗ trợ",
      desc: "Thiết bị hoặc trình duyệt không hỗ trợ thông báo",
      buttonText: "Không hỗ trợ",
      buttonColor: "bg-gray-100 text-gray-400 cursor-not-allowed",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`border rounded-2xl p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          status === "granted" ? "bg-green-100" :
          status === "denied" ? "bg-red-100" :
          status === "unsupported" ? "bg-gray-100" : "bg-primary-50"
        }`}>
          <Icon size={20} className={config.color} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm">Thông báo</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status === "granted" ? "bg-green-100 text-green-700" :
              status === "denied" ? "bg-red-100 text-red-700" :
              status === "unsupported" ? "bg-gray-200 text-gray-500" : "bg-primary-100 text-primary-700"
            }`}>
              {config.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
        </div>

        {/* Button */}
        <button
          onClick={handleToggle}
          disabled={status === "unsupported" || status === "granted"}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${config.buttonColor}`}
        >
          {loading ? "..." : config.buttonText}
        </button>
      </div>

      {/* Hướng dẫn khi bị từ chối */}
      {status === "denied" && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-600 space-y-1">
              <p className="font-medium">Cách bật lại thông báo:</p>
              <p><strong>Chrome Android:</strong> Cài đặt → Trang web → Thông báo → Cho phép</p>
              <p><strong>iPhone Safari:</strong> Cài đặt → Lumo → Thông báo → Cho phép</p>
              <p><strong>Chrome Desktop:</strong> Cài đặt → Quyền riêng tư → Thông báo → Cho phép site</p>
            </div>
          </div>
        </div>
      )}

      {/* Gợi ý khi chưa bật */}
      {status === "default" && (
        <div className="mt-3 pt-3 border-t border-primary-200">
          <div className="flex items-start gap-2">
            <Bell size={14} className="text-primary-400 shrink-0 mt-0.5" />
            <p className="text-xs text-primary-600">
              Sau khi bật, bạn sẽ nhận được thông báo nhắc lịch ngay cả khi app đang đóng.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
