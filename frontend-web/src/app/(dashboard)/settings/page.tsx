"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  User, Lock, Save, Smartphone, Activity,
  Plus, Trash2, Bell, X, RefreshCw,
  CheckCircle2, XCircle, QrCode, Zap,
} from "lucide-react";
import { useDeviceStore } from "@/store/deviceStore";
import { useEventButtonStore } from "@/store/eventButtonStore";
import { adminApi } from "@/features/admin/api";
import type { Device, EventButton } from "@/types";
import { format, isToday, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddDeviceModal } from "@/components/devices/AddDeviceModal";
import { NotificationSettingCard, PushBanner } from "@/components/notifications/PushNotificationPrompt";

/* ── Schemas ── */
const profileSchema = z.object({
  full_name: z.string().min(2, "Tên quá ngắn"),
  phone: z.string().optional(),
  avatar_url: z.string().url("URL không hợp lệ").optional().or(z.literal("")),
});
const pwSchema = z.object({
  old_password: z.string().min(6),
  new_password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});
type ProfileForm = z.infer<typeof profileSchema>;
type PwForm = z.infer<typeof pwSchema>;

/* ── Tab definitions ── */
type Tab = "profile" | "password" | "devices" | "notifications" | "logs";
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile",       label: "Hồ sơ",       icon: User },
  { key: "password",      label: "Mật khẩu",     icon: Lock },
  { key: "devices",      label: "Thiết bị",     icon: Smartphone },
  { key: "notifications", label: "Thông báo",   icon: Bell },
  { key: "logs",         label: "Nhật ký nút",  icon: Activity },
];

/* ════════════════════════════════════════ */
/*   Sub-panels                             */
/* ════════════════════════════════════════ */

function ProfilePanel() {
  const { user, setUser } = useAuthStore();
  const [msg, setMsg] = useState("");
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name || "", phone: user?.phone || "", avatar_url: user?.avatar_url || "" },
  });
  const save = async (data: ProfileForm) => {
    const res = await api.patch("/users/me", data);
    setUser(res.data);
    setMsg("Cập nhật thành công!");
    setTimeout(() => setMsg(""), 3000);
  };
  return (
    <form onSubmit={form.handleSubmit(save)} className="card p-6 space-y-4">
      {msg && <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
        <input {...form.register("full_name")} className="input-field" />
        {form.formState.errors.full_name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.full_name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
        <input {...form.register("phone")} className="input-field" placeholder="0901234567" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh đại diện</label>
        <input {...form.register("avatar_url")} className="input-field" placeholder="https://..." />
      </div>
      <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
        <Save size={15} />{form.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}

function PasswordPanel() {
  const [msg, setMsg] = useState("");
  const form = useForm<PwForm>({ resolver: zodResolver(pwSchema) });
  const submit = async (data: PwForm) => {
    await api.patch("/users/me/password", data);
    form.reset();
    setMsg("Đổi mật khẩu thành công!");
    setTimeout(() => setMsg(""), 3000);
  };
  return (
    <form onSubmit={form.handleSubmit(submit)} className="card p-6 space-y-4">
      {msg && <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
        <input type="password" {...form.register("old_password")} className="input-field" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
        <input type="password" {...form.register("new_password")} className="input-field" />
        {form.formState.errors.new_password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.new_password.message}</p>}
      </div>
      <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
        <Lock size={15} />{form.formState.isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
      </button>
    </form>
  );
}

function DevicesPanel() {
  const { devices, loading, fetchDevices, deleteDevice } = useDeviceStore();
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<Device | null>(null);
  const [qrTarget, setQrTarget] = useState<Device | null>(null);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa thiết bị này?")) return;
    setDeletingId(id);
    try { await deleteDevice(id); toast.success("Đã xóa"); }
    catch { toast.error("Xóa thất bại"); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Thiết bị LUMO được liên kết với tài khoản</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> Thêm
        </button>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Đang tải...</div>
      ) : devices.length === 0 ? (
        <div className="card p-10 text-center">
          <Smartphone size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4 text-sm">Chưa có thiết bị nào</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            Thêm thiết bị đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device: Device) => (
            <div key={device.id} className="card p-4 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
                    <Smartphone size={18} className="text-white" />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                    device.is_active ? "bg-green-500 animate-pulse" : "bg-gray-300"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-gray-900 tracking-widest text-sm">{device.device_id}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      device.is_active ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-100 text-gray-400 border border-gray-200"
                    }`}>
                      {device.is_active ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{device.is_active ? "Đang hoạt động" : "Không hoạt động"}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setQrTarget(device)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Mã QR">
                    <QrCode size={15} />
                  </button>
                  <button onClick={() => setNotifyTarget(device)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Gửi thông báo">
                    <Bell size={15} />
                  </button>
                  <button onClick={() => handleDelete(device.id)} disabled={deletingId === device.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add device modal */}
      {showAdd && (
        <AddDeviceModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={fetchDevices}
        />
      )}

      {/* QR modal */}
      {qrTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Mã QR cặp đôi</h2>
              <button onClick={() => setQrTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/api/v1/devices/qr" alt="QR Code" className="w-48 h-48 object-contain" />
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">Dùng thiết bị LUMO quét mã này để cặp đôi</p>
            </div>
          </div>
        </div>
      )}

      {/* Notify modal */}
      {notifyTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Gửi thông báo — {notifyTarget.device_id}</h2>
              <button onClick={() => setNotifyTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const title = (fd.get("title") as string)?.trim();
                const body = (fd.get("body") as string)?.trim();
                if (!title || !body) { toast.error("Nhập đủ tiêu đề và nội dung"); return; }
                try { await adminApi.notifyDevice(notifyTarget.device_id, title, body); toast.success("Đã gửi"); setNotifyTarget(null); }
                catch { toast.error("Gửi thất bại"); }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                <input name="title" className="input-field" placeholder="Nhắc lịch học" required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
                <textarea name="body" className="input-field resize-none" rows={3} placeholder="Bạn có lịch học vào 14:00" required />
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                <Zap size={15} /> Gửi thông báo
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LogsPanel() {
  const { events, todayStatus, loading, todayLoading, fetchEvents, fetchTodayStatus } = useEventButtonStore();

  useEffect(() => { fetchEvents(); fetchTodayStatus(); }, [fetchEvents, fetchTodayStatus]);

  const todayEvents = events.filter((e) => isToday(parseISO(e.time_button_click)));
  const groupedByDate: Record<string, EventButton[]> = {};
  events.forEach((e) => {
    const key = format(parseISO(e.time_button_click), "yyyy-MM-dd");
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(e);
  });
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Hôm nay</p>
            <p className="font-bold text-gray-900">{todayStatus?.total_today ?? 0} lần</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${todayStatus?.clicked_today ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"}`}>
            {todayStatus?.clicked_today ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          </div>
          <div>
            <p className="text-xs text-gray-400">Trạng thái</p>
            <p className="font-bold text-gray-900">{todayStatus?.clicked_today ? "Đã bấm" : "Chưa bấm"}</p>
          </div>
        </div>
      </div>

      {/* Today */}
      <div className="card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">Hôm nay</h2>
          <button onClick={() => { fetchEvents(); fetchTodayStatus(); }} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
        {todayLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : todayEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chưa có lần bấm nào hôm nay</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayEvents.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-sm font-mono text-gray-700">{format(parseISO(e.time_button_click), "HH:mm:ss")}</span>
                <span className="text-sm text-gray-400">Thiết bị #{e.device_code}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {sortedDates.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-gray-800 text-sm">Lịch sử</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedDates.slice(0, 30).map((date) => {
                const dayEvents = groupedByDate[date];
                return (
                  <div key={date}>
                    <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">{format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                      <span className="text-xs text-gray-400">{dayEvents.length} lần</span>
                    </div>
                    {dayEvents.map((e) => (
                      <div key={e.id} className="px-4 py-2 flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-600">{format(parseISO(e.time_button_click), "HH:mm:ss")}</span>
                        <span className="text-sm text-gray-400">Thiết bị #{e.device_code}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════ */
/*   Page                                  */
/* ════════════════════════════════════════ */
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Cài đặt</h1>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "profile"  && <ProfilePanel />}
      {tab === "password" && <PasswordPanel />}
      {tab === "devices"  && <DevicesPanel />}
      {tab === "notifications" && (
        <div className="space-y-4">
          <NotificationSettingCard />
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Về thông báo Lumo</h3>
            <div className="space-y-2 text-xs text-gray-500">
              <p>Thông báo giúp bạn nhận được lời nhắc lịch học, sự kiện sắp tới ngay cả khi app đang đóng.</p>
              <p>Có 2 loại thông báo:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Thông báo trong app</strong> — hiển thị trên trang Thông báo</li>
                <li><strong>Push Notification</strong> — gửi đến trình duyệt/thiết bị (cần bật ở tab này)</li>
              </ul>
              <p className="pt-2 border-t">Nếu không nhận được thông báo, hãy kiểm tra quyền trong cài đặt thiết bị hoặc trình duyệt của bạn.</p>
            </div>
          </div>
        </div>
      )}
      {tab === "logs"     && <LogsPanel />}
    </div>
  );
}
