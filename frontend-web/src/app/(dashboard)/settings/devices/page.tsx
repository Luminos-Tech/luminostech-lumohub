"use client";
import { useEffect, useState } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import { adminApi } from "@/features/admin/api";
import type { Device } from "@/types";
import {
  Smartphone,
  Plus,
  X,
  Bell,
  Trash2,
  QrCode,
  Wifi,
  WifiOff,
  Zap,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { AddDeviceModal } from "@/components/devices/AddDeviceModal";

/* ─────────────────────────────────────────────
   Helper: 计算设备在线状态
───────────────────────────────────────────── */
function getDeviceUptime(createdAt: string): string {
  try {
    return formatDistanceToNow(parseISO(createdAt), { addSuffix: true, locale: vi });
  } catch {
    return "không rõ";
  }
}

/* ─────────────────────────────────────────────
   Modal: 设备配对码（让设备扫描）
   用于已添加的设备，让设备反向扫描来重新配对
───────────────────────────────────────────── */
function DeviceQRModal({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mã QR cặp đôi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cho thiết bị LUMO quét</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* 说明 */}
          <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-primary-50 rounded-xl w-full">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
              <QrCode size={20} className="text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-primary-600 font-medium">Tự động ghép đôi</p>
              <p className="text-sm text-gray-700">Thiết bị quét là xong</p>
            </div>
          </div>

          {/* QR码 */}
          <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/v1/devices/qr"
              alt="QR Code"
              className="w-52 h-52 object-contain"
            />
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Dùng thiết bị LUMO quét mã này để ghép đôi
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Modal: 发送通知
───────────────────────────────────────────── */
function NotifyModal({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { toast.error("Nhập đủ tiêu đề và nội dung"); return; }
    setSending(true);
    try {
      await adminApi.notifyDevice(device.device_id, title.trim(), body.trim());
      toast.success("Đã gửi thông báo");
      onClose();
    } catch { toast.error("Gửi thất bại"); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">Gửi thông báo</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Smartphone size={16} className="text-gray-400" />
            <p className="font-mono font-bold text-gray-700 text-sm tracking-widest">{device.device_id}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
              placeholder="Nhắc lịch học"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nội dung</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none text-sm"
              rows={3}
              placeholder="Bạn có lịch học vào 14:00"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={15} />
            {sending ? "Đang gửi..." : "Gửi thông báo"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   设备卡片组件
───────────────────────────────────────────── */
function DeviceCard({
  device,
  onDelete,
  onNotify,
  onShowQR,
  deletingId,
}: {
  device: Device;
  onDelete: (id: number) => void;
  onNotify: (device: Device) => void;
  onShowQR: (device: Device) => void;
  deletingId: number | null;
}) {
  const isOnline = device.is_active;
  const uptime = getDeviceUptime(device.created_at);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        {/* 设备图标 + 状态指示灯 */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-200">
            <Smartphone size={24} className="text-white" />
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
              isOnline ? "bg-green-500 animate-pulse" : "bg-gray-300"
            }`}
          />
        </div>

        {/* 设备信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold font-mono text-gray-900 text-base tracking-widest">
              {device.device_id}
            </p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isOnline ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-100 text-gray-400 border border-gray-200"
            }`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              {isOnline ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} />}
              {isOnline ? "Đã kết nối" : "Chưa kết nối"}
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={12} />
              Thêm {uptime}
            </div>
          </div>
        </div>

        {/* 操作按钮（悬停显示） */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onShowQR(device)}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
            title="Mã QR"
          >
            <QrCode size={16} />
          </button>
          <button
            onClick={() => onNotify(device)}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
            title="Gửi thông báo"
          >
            <Bell size={16} />
          </button>
          <button
            onClick={() => onDelete(device.id)}
            disabled={deletingId === device.id}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40"
            title="Xóa thiết bị"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 底部快捷操作 */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => onNotify(device)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
        >
          <Bell size={13} />
          Gửi thông báo
        </button>
        <button
          onClick={() => onShowQR(device)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
        >
          <QrCode size={13} />
          Mã QR
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   空状态
───────────────────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-primary-100 flex items-center justify-center mb-6">
        <Smartphone size={40} className="text-primary-400" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Chưa có thiết bị nào</h3>
      <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
        Thêm thiết bị LUMO bằng cách quét mã QR trên thiết bị
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-primary-200"
      >
        <Plus size={16} />
        Thêm thiết bị đầu tiên
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   主页面
───────────────────────────────────────────── */
export default function DevicesPage() {
  const { devices, loading, fetchDevices, deleteDevice } = useDeviceStore();
  const [showAdd, setShowAdd] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<Device | null>(null);
  const [qrTarget, setQrTarget] = useState<Device | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa thiết bị này?")) return;
    setDeletingId(id);
    try { await deleteDevice(id); toast.success("Đã xóa"); }
    catch { toast.error("Xóa thất bại"); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 - 紧凑设计，避免与全局 Topbar 叠加过高 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
              <Smartphone size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Thiết bị</h1>
              <p className="text-xs text-gray-400">{devices.length} thiết bị đã kết nối</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-primary-200"
          >
            <Plus size={15} />
            Thêm thiết bị
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-400">Đang tải...</p>
          </div>
        ) : devices.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-3">
            {devices.map((device: Device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onDelete={handleDelete}
                onNotify={setNotifyTarget}
                onShowQR={setQrTarget}
                deletingId={deletingId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddDeviceModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={fetchDevices}
        />
      )}

      {qrTarget && (
        <DeviceQRModal
          device={qrTarget}
          onClose={() => setQrTarget(null)}
        />
      )}

      {notifyTarget && (
        <NotifyModal
          device={notifyTarget}
          onClose={() => setNotifyTarget(null)}
        />
      )}
    </div>
  );
}
