"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getWebSocketBaseUrl } from "@/lib/publicApi";
import { useDeviceStore } from "@/store/deviceStore";

interface WsMessage {
  time: string;
  dir: "in" | "out";
  data: string;
}

export function useLumoWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);

  const connect = useCallback((deviceId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setStatus("connecting");
    const wsUrl = getWebSocketBaseUrl();
    const ws = new WebSocket(`${wsUrl}/ws/lumo?device_id=${deviceId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      addMsg("out", "ping");
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
          addMsg("out", "ping");
        }
      }, 30000);
      ws.onclose = () => clearInterval(interval);
    };

    ws.onmessage = (e) => {
      addMsg("in", e.data);
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      if (!wsRef.current) return;
      reconnectTimer.current = setTimeout(() => connect(deviceId), 5000);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  const sendMessage = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
      addMsg("out", data);
    }
  }, []);

  const addMsg = (dir: "in" | "out", data: string) => {
    const time = new Date().toLocaleTimeString();
    setMessages((prev) => [...prev.slice(-99), { time, dir, data }]);
  };

  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { status, messages, connect, disconnect, sendMessage };
}
