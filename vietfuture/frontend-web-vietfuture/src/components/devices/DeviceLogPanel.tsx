"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { ChevronDown, ChevronUp, Pause, Play, Terminal, Trash2 } from "lucide-react";
import { devicesApi } from "@/features/devices/api";
import type { DeviceLogEntry } from "@/types";

export function DeviceLogPanel({ deviceId, isEnglish }: { deviceId: number; isEnglish: boolean }) {
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState<DeviceLogEntry[]>([]);
  const [level, setLevel] = useState<"all" | "I" | "W" | "E">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<number | null>(null);
  const cursor = useRef(0);
  const stream = useRef<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cursor.current = 0;
    stream.current = null;
    setEntries([]);
    setError(null);
  }, [deviceId]);

  useEffect(() => {
    if (!open || paused) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    const refresh = async () => {
      let delay = 2000;
      try {
        const { data } = await devicesApi.logs(deviceId, cursor.current);
        if (!active) return;
        setError(null);
        setConnected(data.connected);
        setSupported(data.supported);
        if (stream.current !== null && stream.current !== data.stream_id) {
          cursor.current = 0;
          setEntries([]);
        } else {
          cursor.current = data.cursor;
          setEntries((previous) => [...previous, ...data.entries].slice(-200));
        }
        stream.current = data.stream_id;
      } catch (failure) {
        if (active) setError(isAxiosError(failure) ? failure.response?.status ?? 0 : 0);
        delay = 10000;
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(refresh, delay);
        }
      }
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [open, paused, deviceId]);

  useEffect(() => {
    if (open && autoScroll && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    }
  }, [entries, autoScroll, open, level]);

  const errorText = error === 404
    ? (isEnglish ? "Update the server backend to view device logs." : "Cần cập nhật backend trên máy chủ để xem log thiết bị.")
    : error === 401 || error === 403
      ? (isEnglish ? "Sign in to view logs. The feature may be temporarily disabled." : "Đăng nhập để xem log. Chức năng cũng có thể đang tắt tạm thời.")
      : (isEnglish ? "Could not load logs. Retrying shortly." : "Chưa tải được log. Hệ thống sẽ thử lại.");
  const visible = entries.filter((entry) => level === "all" || entry.level === level);

  return (
    <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        aria-controls={`device-logs-${deviceId}`}
        className="flex w-full items-center justify-between rounded-lg py-1 text-sm font-semibold text-teal-800 dark:text-teal-200">
        <span className="inline-flex items-center gap-2"><Terminal size={17} />{isEnglish ? "Live device logs" : "Log trực tiếp"}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div id={`device-logs-${deviceId}`} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={error !== null ? "text-red-600" : connected ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}>
              {error !== null ? (isEnglish ? "Unavailable" : "Chưa tải được")
                : paused ? (isEnglish ? "Paused" : "Đã tạm dừng")
                : loading ? (isEnglish ? "Loading..." : "Đang tải...")
                : connected ? (isEnglish ? "Receiving · every 2s" : "Đang nhận · mỗi 2 giây")
                : (isEnglish ? "Hub offline · recent logs" : "Hub offline · log gần nhất")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setPaused((value) => !value)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-700">
                {paused ? <Play size={13} /> : <Pause size={13} />}
                {paused ? (isEnglish ? "Resume" : "Tiếp tục") : (isEnglish ? "Pause" : "Tạm dừng")}
              </button>
              <button type="button" onClick={() => setEntries([])}
                aria-label={isEnglish ? "Clear log view" : "Xóa màn hình log"}
                className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2">
              {isEnglish ? "Level" : "Mức log"}
              <select value={level} onChange={(event) => setLevel(event.target.value as typeof level)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <option value="all">{isEnglish ? "All" : "Tất cả"}</option>
                <option value="I">{isEnglish ? "Info" : "Thông tin"}</option>
                <option value="W">{isEnglish ? "Warnings" : "Cảnh báo"}</option>
                <option value="E">{isEnglish ? "Errors" : "Lỗi"}</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} />
              {isEnglish ? "Auto-scroll" : "Cuộn theo log"}
            </label>
          </div>
          {error !== null && <p role="status" className="text-xs text-red-600 dark:text-red-400">{errorText}</p>}
          {!supported && connected && error === null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{isEnglish
              ? "Update Hub firmware for device logs. Server events are still available."
              : "Cập nhật firmware Hub để nhận log thiết bị. Hiện vẫn xem được sự kiện từ server."}</p>
          )}
          <div ref={viewport} aria-label={isEnglish ? "Device log entries" : "Nội dung log thiết bị"}
            className="h-64 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-xs text-slate-200">
            {visible.length === 0 ? <p className="py-6 text-center text-slate-500">{loading
              ? (isEnglish ? "Loading logs..." : "Đang tải log...")
              : (isEnglish ? "No logs to display." : "Chưa có log để hiển thị.")}</p>
              : visible.map((entry) => (
                <div key={`${stream.current}-${entry.sequence}`} className="border-b border-slate-800 py-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    <time>{new Date(entry.received_at).toLocaleTimeString(isEnglish ? "en-GB" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}</time>
                    <span className={entry.level === "E" ? "text-red-400" : entry.level === "W" ? "text-amber-300" : "text-emerald-400"}>{entry.level}</span>
                    <span>{entry.tag}</span>
                    {entry.uptime_ms !== null && <span>↑{Math.floor(entry.uptime_ms / 1000)}s</span>}
                  </div>
                  <p className="mt-1 break-words whitespace-pre-wrap">{entry.message}</p>
                </div>
              ))}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">{isEnglish
            ? "Vietnam time (UTC+7). Server buffer: 200 lines / 15 minutes. Technical events only; no passwords or audio content."
            : "Giờ Việt Nam (UTC+7). Bộ đệm server: 200 dòng / 15 phút. Chỉ gửi sự kiện kỹ thuật, không gửi mật khẩu hay nội dung âm thanh."}</p>
        </div>
      )}
    </div>
  );
}
