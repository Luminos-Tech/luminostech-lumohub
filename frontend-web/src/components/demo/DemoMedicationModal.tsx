"use client";

import { useState } from "react";
import { Check, Clock, Heart, Mic, Pill, Play, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demoStore";

export default function DemoMedicationModal() {
  const { activeScenarioModal, closeScenarioModal } = useDemoStore();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isTaken, setIsTaken] = useState(false);

  const isOpen = activeScenarioModal === "med-reminder";

  if (!isOpen) return null;

  const handlePlayVoice = () => {
    setIsPlayingAudio(true);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text = "Mẹ ơi đến 9 giờ rồi, mẹ nhớ uống 1 viên thuốc huyết áp màu trắng và 1 viên thuốc khớp nhé!";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setIsPlayingAudio(false);
      }, 3500);
    }
  };

  const handleConfirmTaken = () => {
    setIsTaken(true);
    toast.success("Đã ghi nhận: Cụ Mai đã uống thuốc đúng giờ!");
    setTimeout(() => {
      closeScenarioModal();
      setIsTaken(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl text-white p-6 sm:p-8 flex flex-col items-center">
        
        {/* Header Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mb-4 shadow-inner">
          <Pill size={32} className="animate-pulse" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 text-xs font-bold tracking-wider text-amber-300 uppercase rounded-full bg-amber-500/20 border border-amber-500/40">
          <Clock size={13} /> Lịch nhắc lúc 09:00 Sáng
        </span>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
          Đến giờ uống thuốc sáng
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mb-6 text-center">
          LUMO Hub phát lời nhắc qua loa thông minh và đồng bộ với ứng dụng gia đình.
        </p>

        {/* Prescription List */}
        <div className="w-full space-y-2.5 mb-6">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-100 text-sm">Amlodipine 5mg</p>
                <p className="text-xs text-slate-400">Thuốc huyết áp · 1 viên màu trắng (Sau ăn sáng)</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
              1 viên
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-100 text-sm">Glucosamine 500mg</p>
                <p className="text-xs text-slate-400">Thuốc bổ xương khớp · 1 viên vàng</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              1 viên
            </span>
          </div>
        </div>

        {/* Family Voice Message Player */}
        <div className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Mic size={15} />
              <span>Lời nhắn thoại từ Con gái (Chị Linh):</span>
            </div>
            <span className="text-[11px] text-slate-400">0:12s</span>
          </div>
          
          <p className="text-xs italic text-slate-300 mb-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
            &ldquo;Mẹ ơi đến 9 giờ rồi, mẹ nhớ uống 1 viên thuốc huyết áp màu trắng và 1 viên thuốc khớp nhé!&rdquo;
          </p>

          <button
            type="button"
            onClick={handlePlayVoice}
            className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              isPlayingAudio
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
                : "bg-slate-700/60 hover:bg-slate-700 border-slate-600 text-slate-200"
            }`}
          >
            {isPlayingAudio ? <Volume2 size={16} className="animate-spin" /> : <Play size={15} />}
            {isPlayingAudio ? "Đang phát giọng nói qua LUMO Hub..." : "Nghe lại giọng nói của con gái"}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleConfirmTaken}
            disabled={isTaken}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
          >
            <Check size={18} />
            {isTaken ? "Đã xác nhận!" : "Cụ đã uống xong"}
          </button>

          <button
            type="button"
            onClick={closeScenarioModal}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all font-semibold text-slate-300 border border-slate-700 flex items-center justify-center gap-2"
          >
            <Clock size={16} />
            Nhắc lại sau 15 phút
          </button>
        </div>

        <button
          type="button"
          onClick={closeScenarioModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
          title="Đóng modal"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
