"use client";
import { useEffect, useRef, useState } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import { adminApi } from "@/features/admin/api";
import { getWebSocketBaseUrl } from "@/lib/publicApi";
import { useAuthStore } from "@/store/authStore";
import { Wifi, WifiOff, ArrowDownLeft, Trash2, Send, Volume2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface WsMessage {
  time: string;
  dir: "in" | "out";
  data: string;
}

export default function AdminWsPage() {
  const { devices, fetchDevices } = useDeviceStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [sending, setSending] = useState(false);

  // text display
  const [textMsg, setTextMsg] = useState<string>("");

  // TTS state
  const [ttsText, setTtsText] = useState<string>("");
  const [ttsSending, setTtsSending] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<string>("");

  const wsStreamRef = useRef<WebSocket | null>(null);
  const wsLumoRef = useRef<WebSocket | null>(null);
  const [espConnected, setEspConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    return () => {
      wsLumoRef.current?.close();
      wsStreamRef.current?.close();
    };
  }, []);

  // ─── ESP32 WebSocket (nhận PCM để phát) ─────────────────────────────────
  const connectEsp = () => {
    if (!selectedDevice) { toast.error("Chọn thiết bị trước"); return; }
    wsLumoRef.current?.close();
    const ws = new WebSocket(`${getWebSocketBaseUrl()}/ws/lumo?device_id=${selectedDevice}`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      setEspConnected(true);
      ws.send(JSON.stringify({ type: "online", device_id: selectedDevice }));
      addMsg("in", `[ESP32] ✓ Connected`);
    };
    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        addMsg("in", `[ESP32] TEXT: ${e.data}`);
      } else {
        const kb = (e.data as ArrayBuffer).byteLength / 1024;
        addMsg("in", `[ESP32] PCM: ${kb.toFixed(1)} KB binary`);
      }
    };
    ws.onclose = () => { setEspConnected(false); addMsg("in", `[ESP32] ✗ Disconnected`); };
    ws.onerror = () => { setEspConnected(false); addMsg("in", `[ESP32] ✗ Error`); };
    wsLumoRef.current = ws;
  };

  const disconnectEsp = () => {
    wsLumoRef.current?.close();
    wsLumoRef.current = null;
    setEspConnected(false);
  };

  // ─── Gửi text hiển thị (REST → WS → ESP32) ─────────────────────────────
  const sendText = async () => {
    const text = textMsg.trim();
    if (!text || !selectedDevice) return;
    setSending(true);
    try {
      await adminApi.sendTextToDevice(selectedDevice, text);
      addMsg("out", `[Text] ${text}`);
      setTextMsg("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Gửi thất bại — thiết bị chưa kết nối");
      addMsg("out", `✗ ${msg}`);
    } finally {
      setSending(false);
    }
  };

  // ─── Gửi TTS (website → /ws/stream → PCM → forward → ESP32 phát) ───────
  const sendTts = async () => {
    const text = ttsText.trim();
    if (!text || !selectedDevice) return;
    if (!espConnected) { toast.error("Bấm Kết nối ESP32 trước"); return; }

    setTtsSending(true);
    setTtsProgress("Đang kết nối...");
    wsStreamRef.current?.close();

    const ws = new WebSocket(`${getWebSocketBaseUrl()}/ws/stream?device_id=${selectedDevice}`);
    ws.binaryType = "arraybuffer";
    wsStreamRef.current = ws;

    ws.onopen = () => {
      setTtsProgress(`TTS: "${text}"`);
      ws.send(JSON.stringify({ action: "tts", text }));
    };

    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const obj = JSON.parse(e.data);
          if (obj.type === "done") {
            setTtsProgress("✓ Hoàn tất");
            addMsg("out", `[TTS] done`);
            ws.close();
          } else if (obj.type === "error") {
            setTtsProgress(`✗ Lỗi: ${obj.message}`);
            addMsg("out", `[TTS] error: ${obj.message}`);
            ws.close();
          }
        } catch { setTtsProgress(e.data); }
      } else {
        const kb = e.data.byteLength / 1024;
        setTtsProgress(`← PCM ${kb.toFixed(1)} KB → ESP32 (/ws/lumo)`);
      }
    };

    ws.onerror = () => { setTtsProgress("✗ Lỗi /ws/stream"); setTtsSending(false); };
    ws.onclose = () => setTtsSending(false);
  };

  const addMsg = (dir: "in" | "out", data: string) => {
    const time = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev.slice(-199), { time, dir, data }]);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ESP32</h1>
          <p className="text-sm text-gray-500 mt-1">Gửi text hoặc TTS đến thiết bị ESP32.</p>
        </div>
        <div className={`flex items-center gap-2 text-sm ${espConnected ? "text-green-600" : "text-gray-400"}`}>
          <Wifi size={14} />
          <span>{espConnected ? "ESP32 online" : "Chưa kết nối"}</span>
        </div>
      </div>

      {/* Device selector */}
      <div className="card p-4">
        <div className="flex gap-2">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">— Chọn thiết bị —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.device_id}>{d.device_id}</option>
            ))}
          </select>
          {espConnected ? (
            <button onClick={disconnectEsp} className="btn-danger">Ngắt</button>
          ) : (
            <button onClick={connectEsp} disabled={!selectedDevice} className="btn-primary">
              <Wifi size={14} /> Kết nối ESP32
            </button>
          )}
        </div>
      </div>

      {/* Ô 1: Hiển thị text (chỉ admin) */}
      {isAdmin ? (
        <div className="card p-4 space-y-3 border-l-4 border-blue-400">
          <div className="flex items-center gap-2 text-blue-700 font-medium">
            <MessageSquare size={16} />
            Hiển thị text trên ESP32
          </div>
          <div className="flex gap-2">
            <input
              value={textMsg}
              onChange={(e) => setTextMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              className="input-field flex-1"
              placeholder="Nhập text để hiển thị trên màn hình ESP32..."
              disabled={sending || !selectedDevice}
            />
            <button
              onClick={sendText}
              disabled={sending || !selectedDevice || !textMsg.trim()}
              className="btn-primary flex items-center gap-1"
            >
              <Send size={14} /> Gửi
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-gray-400">
          Chỉ admin mới có thể gửi text đến ESP32.
        </div>
      )}

      {/* Ô 2: Phát TTS (chỉ admin) */}
      {isAdmin ? (
        <div className="card p-4 space-y-3 border-l-4 border-purple-400">
          <div className="flex items-center gap-2 text-purple-700 font-medium">
            <Volume2 size={16} />
            Phát âm thanh trên ESP32
          </div>
          <div className="flex gap-2">
            <input
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTts()}
              className="input-field flex-1"
              placeholder="Nhập text để TTS phát trên ESP32..."
              disabled={ttsSending || !selectedDevice}
            />
            <button
              onClick={sendTts}
              disabled={ttsSending || !selectedDevice || !ttsText.trim()}
              className="btn-primary flex items-center gap-1"
            >
              <Volume2 size={14} /> {ttsSending ? "Đang..." : "Phát"}
            </button>
          </div>
          {ttsProgress && (
            <div className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-1">
              {ttsProgress}
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-gray-400">
          Chỉ admin mới có thể phát TTS trên ESP32.
        </div>
      )}

      {/* Log */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">Log</span>
          <button onClick={() => setMessages([])} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Trash2 size={12} /> Xóa
          </button>
        </div>
        <div className="h-64 overflow-y-auto p-3 space-y-1 bg-gray-950 font-mono text-xs" style={{ fontFamily: "monospace" }}>
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">Chưa có tin nhắn nào</div>
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

    </div>
  );
}
