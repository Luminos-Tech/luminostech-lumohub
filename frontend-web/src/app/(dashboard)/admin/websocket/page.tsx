"use client";
import { useEffect, useRef, useState } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import { getWebSocketBaseUrl } from "@/lib/publicApi";
import { useAuthStore } from "@/store/authStore";
import { Wifi, WifiOff, ArrowUpRight, ArrowDownLeft, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface WsMessage {
  time: string;
  dir: "in" | "out";
  data: string;
}

export default function AdminWsPage() {
  const { devices, fetchDevices } = useDeviceStore();
  const { user } = useAuthStore();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [manualMsg, setManualMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const connect = () => {
    if (!selectedDevice) {
      toast.error("Chọn thiết bị trước");
      return;
    }
    wsRef.current?.close();

    const wsUrl = getWebSocketBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/lumo?device_id=${selectedDevice}`);
    wsRef.current = ws;
    setStatus("connecting");
    addMsg("out", `CONNECT → /ws/lumo?device_id=${selectedDevice}`);

    ws.onopen = () => {
      setStatus("connected");
      addMsg("in", "✓ Connected");
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
          addMsg("out", "ping");
        }
      }, 30000);
    };

    ws.onmessage = (e) => {
      addMsg("in", e.data);
    };

    ws.onerror = () => {
      setStatus("disconnected");
      addMsg("in", "✗ Error");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      addMsg("in", "✗ Disconnected");
      if (pingRef.current) clearInterval(pingRef.current);
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
    if (pingRef.current) clearInterval(pingRef.current);
  };

  const sendText = () => {
    const text = manualMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(text);
    addMsg("out", text);
    setManualMsg("");
  };

  const addMsg = (dir: "in" | "out", data: string) => {
    const time = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev.slice(-199), { time, dir, data }]);
  };

  const statusColor = status === "connected" ? "text-green-600" : status === "connecting" ? "text-yellow-500" : "text-gray-400";
  const statusLabel = status === "connected" ? "Đã kết nối" : status === "connecting" ? "Đang kết nối..." : "Chưa kết nối";
  const StatusIcon = status === "connected" ? Wifi : WifiOff;

  const canNotify = user?.role === "admin";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">WebSocket Debug</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kết nối trực tiếp đến thiết bị qua WS để xem log & gửi test.
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium ${statusColor}`}>
          <StatusIcon size={16} />
          {statusLabel}
        </div>
      </div>

      {/* Device selector + connect */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="input-field flex-1"
            disabled={status === "connected"}
          >
            <option value="">— Chọn thiết bị —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.device_id}>
                {d.device_id}
              </option>
            ))}
          </select>
          {status === "connected" ? (
            <button onClick={disconnect} className="btn-danger">
              Ngắt
            </button>
          ) : (
            <button onClick={connect} disabled={!selectedDevice} className="btn-primary">
              Kết nối
            </button>
          )}
        </div>
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
                <span className="shrink-0">{m.dir === "in" ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}</span>
                <span className="break-all">{m.data}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Send message */}
      <div className="card p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Gửi text (device nhận được JSON)</p>
        <div className="flex gap-2">
          <input
            value={manualMsg}
            onChange={(e) => setManualMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            className="input-field flex-1 font-mono text-sm"
            placeholder={'{"title":"...","body":"..."}'}
            disabled={status !== "connected"}
          />
          <button
            onClick={sendText}
            disabled={status !== "connected" || !manualMsg.trim()}
            className="btn-primary flex items-center gap-1"
          >
            <Send size={14} />
            Gửi
          </button>
        </div>
        {canNotify && (
          <p className="text-xs text-gray-400 mt-2">
            Hoặc dùng nút 🔔 trong trang Thiết bị để gửi notification đúng format.
          </p>
        )}
      </div>
    </div>
  );
}
