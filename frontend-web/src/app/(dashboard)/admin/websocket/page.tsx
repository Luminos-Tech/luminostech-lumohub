"use client";
import { useEffect, useRef, useState } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import { adminApi } from "@/features/admin/api";
import { Wifi, WifiOff, ArrowDownLeft, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

interface WsMessage {
  time: string;
  dir: "in" | "out";
  data: string;
}

export default function AdminWsPage() {
  const { devices, fetchDevices } = useDeviceStore();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [manualMsg, setManualMsg] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendText = async () => {
    const text = manualMsg.trim();
    if (!text || !selectedDevice) return;
    setSending(true);
    try {
      await adminApi.sendTextToDevice(selectedDevice, text);
      addMsg("out", text);
      setManualMsg("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Gửi thất bại — thiết bị có thể chưa kết nối");
      addMsg("out", `✗ ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const addMsg = (dir: "in" | "out", data: string) => {
    const time = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev.slice(-199), { time, dir, data }]);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ESP32 Debug</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gửi text đến ESP32 đang kết nối — server sẽ forward qua WebSocket.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Wifi size={14} />
          <span>REST → WS → ESP32</span>
        </div>
      </div>

      {/* Device selector */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">— Chọn thiết bị —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.device_id}>
                {d.device_id}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-400">
          ESP32 phải đang kết nối <code>/ws/lumo?device_id=&lt;id&gt;</code> thì mới nhận được.
        </p>
      </div>

      {/* Message log */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">Log</span>
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <Trash2 size={12} />
            Xóa
          </button>
        </div>
        <div
          className="h-80 overflow-y-auto p-3 space-y-1 bg-gray-950 font-mono text-xs"
          style={{ fontFamily: "monospace" }}
        >
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Chưa có tin nhắn nào
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.dir === "in" ? "text-green-400" : "text-blue-400"}`}>
                <span className="text-gray-500 shrink-0">{m.time}</span>
                <span className="shrink-0">{m.dir === "in" ? <ArrowDownLeft size={11} /> : <Send size={11} />}</span>
                <span className="break-all">{m.data}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Send message */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Gửi text đến ESP32 (server forward qua WebSocket)
        </p>
        <div className="flex gap-2">
          <input
            value={manualMsg}
            onChange={(e) => setManualMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            className="input-field flex-1 font-mono text-sm"
            placeholder="Nhập text để gửi đến ESP32..."
            disabled={!selectedDevice || sending}
          />
          <button
            onClick={sendText}
            disabled={!selectedDevice || !manualMsg.trim() || sending}
            className="btn-primary flex items-center gap-1"
          >
            <Send size={14} />
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
