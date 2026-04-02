"use client";
import { useEffect, useState } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import type { Device } from "@/types";
import { Trash2, Smartphone, Plus, X } from "lucide-react";
import { toast } from "sonner";

export default function DevicesPage() {
  const { devices, loading, fetchDevices, registerDevice, deleteDevice } = useDeviceStore();
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const openAddModal = () => {
    setCode("");
    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      toast.error("Nhập đúng 4 chữ số");
      return;
    }
    setSubmitting(true);
    try {
      await registerDevice(trimmed);
      toast.success("Thêm thành công");
      setShowAdd(false);
    } catch {
      toast.error("Thêm thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Xóa thiết bị này?")) return;
    setDeletingId(id);
    try {
      await deleteDevice(id);
      toast.success("Đã xóa");
    } catch {
      toast.error("Xóa thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Thiết bị</h1>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus size={15} />
          Thêm
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : devices.length === 0 ? (
        <div className="card p-12 text-center">
          <Smartphone size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Chưa có thiết bị nào</p>
          <button onClick={openAddModal} className="btn-primary">
            Thêm thiết bị đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device: Device) => (
            <div key={device.id} className="card p-3 flex items-center gap-3">
              <span className="font-mono font-bold text-lg text-gray-900 tracking-widest flex-1">
                {device.device_id}
              </span>
              <button
                onClick={() => handleDelete(device.id)}
                disabled={deletingId === device.id}
                className="p-2 text-red-400 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Mã thiết bị</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="input-field text-center font-mono text-3xl font-bold tracking-widest"
                placeholder="0000"
                maxLength={4}
                autoFocus
                required
              />
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Đang thêm..." : "Thêm"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
