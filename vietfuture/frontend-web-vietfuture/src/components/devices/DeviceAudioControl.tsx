"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Loader2, Square, Volume2, Wifi, WifiOff } from "lucide-react";
import { devicesApi } from "@/features/devices/api";
import type { Device, DeviceControlStatus, DeviceSound } from "@/types";

const errors: Record<string, [string, string]> = {
  "Device is offline": ["Hub chưa kết nối với máy chủ.", "The Hub is offline."],
  "Device disconnected": ["Hub đã mất kết nối.", "The Hub disconnected."],
  "Device speaker is busy": ["Loa đang bận. Hãy dừng âm thanh hoặc thử lại sau.", "The speaker is busy. Stop audio or try again."],
  "Device did not confirm the command": ["Chưa nhận được xác nhận từ Hub. Kiểm tra thiết bị trước khi thử lại.", "The Hub did not confirm. Check the device before retrying."],
  "Device could not execute the command": ["Hub không phát được âm thanh.", "The Hub could not play the sound."],
  "Firmware does not support audio control": ["Cần cập nhật firmware của Hub để điều khiển loa.", "Update the Hub firmware to control audio."],
};

export function DeviceAudioControl({ device, isEnglish = false, onStatusChange }: {
  device: Device;
  isEnglish?: boolean;
  onStatusChange?: (id: number, status: DeviceControlStatus) => void;
}) {
  const [status, setStatus] = useState<DeviceControlStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [sound, setSound] = useState<DeviceSound>("beep");
  const [playing, setPlaying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const commandNumber = useRef(0);
  const online = status?.connected === true && status.audio_control && !statusError;

  useEffect(() => {
    let active = true;
    const commandCounter = commandNumber;
    let timer: ReturnType<typeof setTimeout>;
    setStatus(null);
    setStatusError(false);
    setFeedback("");
    const refresh = async () => {
      try {
        const response = await devicesApi.controlStatus(device.id);
        if (active) {
          setStatus(response.data);
          setStatusError(false);
          onStatusChange?.(device.id, response.data);
        }
      } catch {
        if (active) {
          setStatusError(true);
          onStatusChange?.(device.id, { connected: false, audio_control: false, firmware_version: null });
        }
      } finally {
        if (active) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); commandCounter.current++; };
  }, [device.id, onStatusChange]);

  const send = async (action: "play" | "stop") => {
    const ticket = ++commandNumber.current;
    if (action === "play") setPlaying(true); else setStopping(true);
    setFailed(false);
    setFeedback(isEnglish ? "Waiting for the Hub..." : "Đang chờ Hub xác nhận...");
    try {
      const response = action === "play"
        ? await devicesApi.playSound(device.id, sound)
        : await devicesApi.stopAudio(device.id);
      if (ticket !== commandNumber.current) return;
      setFeedback(response.data.status === "stopped"
        ? (isEnglish ? "The Hub received the stop request." : "Hub đã nhận yêu cầu dừng âm thanh.")
        : (isEnglish ? "The Hub finished playing the sound." : "Hub đã phát xong âm thanh."));
    } catch (error) {
      if (ticket !== commandNumber.current) return;
      const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
      setFailed(true);
      setFeedback(typeof detail === "string" && errors[detail]
        ? errors[detail][isEnglish ? 1 : 0]
        : (isEnglish ? "Could not control the Hub. Check the connection." : "Không gửi được lệnh đến Hub. Hãy kiểm tra kết nối."));
    } finally {
      if (action === "play") setPlaying(false); else setStopping(false);
    }
  };

  return (
    <section aria-label={isEnglish ? `Speaker control ${device.device_id}` : `Điều khiển loa ${device.device_id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Volume2 size={18} />{isEnglish ? "Hub speaker" : "Loa của Hub"}</h3>
        <span className={`inline-flex items-center gap-1.5 text-xs ${online ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {statusError ? (isEnglish ? "Connection unavailable" : "Không kiểm tra được kết nối")
            : status === null ? (isEnglish ? "Checking..." : "Đang kiểm tra...")
            : online ? (isEnglish ? "Hub connected" : "Hub đang kết nối")
            : status.connected ? (isEnglish ? "Firmware update required" : "Cần cập nhật firmware")
            : (isEnglish ? "Hub offline" : "Hub chưa kết nối")}
        </span>
      </div>
      <p className="text-sm text-slate-500">{isEnglish ? "Play a sound on this Hub's speaker." : "Phát âm thanh trên loa của Hub này."} <span className="font-mono">ID {device.device_id}</span></p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-36 flex-1">
          <span className="sr-only">{isEnglish ? "Sound" : "Âm thanh"}</span>
          <select value={sound} onChange={(event) => setSound(event.target.value as DeviceSound)}
            disabled={playing || !online}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="beep">{isEnglish ? "Test beep" : "Tiếng bíp thử loa"}</option>
            <option value="greeting">{isEnglish ? "Greeting" : "Lời chào LUMO"}</option>
            <option value="checkin">{isEnglish ? "Check-in sound" : "Âm thanh điểm danh"}</option>
          </select>
        </label>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void send("play")} disabled={!online || playing || stopping}>
          {playing ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
          {playing ? (isEnglish ? "Playing..." : "Đang phát...") : (isEnglish ? "Play on Hub" : "Phát trên Hub")}
        </button>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          onClick={() => void send("stop")} disabled={!online || stopping}>
          {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
          {isEnglish ? "Stop" : "Dừng"}
        </button>
      </div>
      {feedback && <p role="status" aria-live="polite" className={`text-sm ${failed ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{feedback}</p>}
    </section>
  );
}
