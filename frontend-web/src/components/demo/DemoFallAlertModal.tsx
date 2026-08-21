"use client";

import { useEffect, useState, useRef } from "react";
import { AlertTriangle, BellRing, Check, MapPin, PhoneCall, ShieldAlert, X } from "lucide-react";
import { useDemoStore } from "@/store/demoStore";

export default function DemoFallAlertModal() {
  const { activeScenarioModal, lastFallTime, dismissFallAlert, mockProfiles, demoTargetProfileId } = useDemoStore();
  const targetProfile = mockProfiles?.find(p => p.id === demoTargetProfileId) || mockProfiles?.find(p => p.type === 'band') || { name: "Mẹ", device_id: "LH-8821" };
  const targetName = targetProfile?.name || "Mẹ";
  const targetDeviceId = targetProfile?.device_id || "LH-8821";

  const [countdown, setCountdown] = useState(30);
  const [isCalling, setIsCalling] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const isOpen = activeScenarioModal === "fall-alert";

  // Play synthetic emergency beeps using Web Audio API safely
  useEffect(() => {
    if (!isOpen) {
      setCountdown(30);
      setIsCalling(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        // Beep sequence
        const playBeep = () => {
          if (ctx.state === "suspended") ctx.resume();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        };

        playBeep();
        const beepInterval = setInterval(playBeep, 1200);
        return () => {
          clearInterval(beepInterval);
          ctx.close().catch(() => {});
        };
      }
    } catch {
      // Audio context not allowed or unsupported
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || countdown <= 0 || isCalling) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, countdown, isCalling]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border-2 border-red-500/80 shadow-2xl shadow-red-500/30 text-white p-6 sm:p-8 flex flex-col items-center text-center">
        
        {/* Pulsing emergency inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide */}
        <div className="relative mb-4">
          <div className="absolute -inset-3 rounded-full bg-red-500/40 animate-ping" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-red-600 border-4 border-red-400 shadow-lg text-white">
            <ShieldAlert size={42} className="animate-bounce" />
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 text-xs font-bold tracking-wider text-red-300 uppercase rounded-full bg-red-500/20 border border-red-500/40">
          <AlertTriangle size={14} /> Cảnh báo an toàn khẩn cấp (SOS)
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          PHÁT HIỆN TÉ NGÃ!
        </h2>
        
        <p className="text-sm sm:text-base text-slate-300 mb-5 max-w-sm">
          Cảm biến LUMO Band ghi nhận va chạm mạnh và bất động lúc{" "}
          <strong className="text-red-400 font-semibold">{lastFallTime || "vừa xong"}</strong>.
        </p>

        {/* Location & Status Card */}
        <div className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 mb-6 text-left space-y-3 shadow-md">
          {/* Device & Signal Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/60">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={15} />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none mb-0.5">Thiết bị gửi SOS</span>
                <strong className="text-slate-100 font-bold text-xs truncate block">LUMO Band ({targetDeviceId})</strong>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-red-300 font-semibold bg-red-950/80 px-2.5 py-1 rounded-full border border-red-700/60 text-[11px] whitespace-nowrap shrink-0 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Đang phát tín hiệu
            </span>
          </div>

          {/* Location row */}
          <div className="flex items-start gap-2.5 pt-0.5">
            <MapPin size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs min-w-0 flex-1">
              <p className="font-semibold text-slate-200">
                Vị trí người thân: {targetProfile.fullName ? `${targetProfile.fullName} (${targetName})` : targetName}
              </p>
              <p className="text-slate-400 leading-snug mt-0.5">
                {targetProfile.address || "Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội"}
              </p>
            </div>
          </div>

          {/* Caregiver & SMS Alert row - structured vertically/flex to avoid any text collision */}
          <div className="pt-2 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 block text-[11px]">Người theo dõi khẩn cấp:</span>
              <strong className="text-slate-200 font-semibold block leading-tight mt-0.5">
                {targetProfile.caregiver || "Anh Trí (Con trai - 0988 123 456)"}
              </strong>
            </div>
            <span className="inline-flex items-center gap-1 self-start sm:self-auto text-[11px] font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-1 rounded-full shrink-0 shadow-xs">
              ✓ Đã gửi SMS & App Alert
            </span>
          </div>
        </div>

        {/* Auto Escalation Timer */}
        <div className="w-full bg-red-950/40 border border-red-500/30 rounded-xl p-3 mb-6 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-red-300 text-left">
            <BellRing size={18} className="animate-spin text-red-400" />
            <span>Tự động kết nối trung tâm cứu hộ 115 sau:</span>
          </div>
          <span className="font-mono text-lg font-bold text-red-400 bg-red-900/60 px-2.5 py-0.5 rounded-lg border border-red-500/40">
            {countdown}s
          </span>
        </div>

        {/* Action Buttons (Child / Caregiver Perspective) */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setIsCalling(true);
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 text-sm"
          >
            <PhoneCall size={18} />
            {isCalling ? "Đang kết nối cuộc gọi..." : `Gọi điện ngay cho ${targetName}`}
          </button>

          <button
            type="button"
            onClick={dismissFallAlert}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all font-semibold text-slate-200 border border-slate-600 flex items-center justify-center gap-2 text-sm"
          >
            <Check size={18} className="text-emerald-400" />
            Đã liên hệ {targetName} (Xác nhận an toàn)
          </button>
        </div>

        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
          💡 <em>{targetName} có thể chạm trực tiếp mặt cảm biến trên LUMO Band ({targetDeviceId}) để tắt cảnh báo báo nhầm. Nếu không chạm, ứng dụng sẽ gọi cấp cứu 115 sau {countdown}s.</em>
        </p>


        <button
          type="button"
          onClick={dismissFallAlert}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
          title="Đóng modal"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
