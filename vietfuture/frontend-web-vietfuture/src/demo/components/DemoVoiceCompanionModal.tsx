"use client";

import { useState } from "react";
import { Bot, Mic, MicOff, Send, Sparkles, User, X } from "lucide-react";
import { useDemoStore, type DemoVoiceMessage } from "@/demo/store";
import { usePreferenceStore } from "@/store/preferenceStore";

const QUICK_PROMPTS_VI = [
  {
    label: "🌤️ Thời tiết hôm nay",
    elderlyText: "LUMO ơi, hôm nay thời tiết thế nào hả con?",
    response: "Dạ thưa Mẹ, hôm nay trời nắng ráo, nhiệt độ 28°C rất mát mẻ. Mẹ nhớ uống đủ nước và đi dạo nhẹ nhàng ở ban công nhé ạ!",
  },
  {
    label: "💊 Lịch uống thuốc",
    elderlyText: "Hôm nay tôi cần uống những thuốc gì?",
    response: "Dạ sáng nay lúc 9 giờ Mẹ đã uống Amlodipine và Glucosamine rồi ạ. Cữ tiếp theo là 19h tối sau bữa ăn Mẹ nhớ uống 1 viên bổ mắt nhé!",
  },
  {
    label: "💌 Lời nhắn con cái",
    elderlyText: "Hôm nay con có nhắn gì không LUMO?",
    response: "Dạ Tuấn Kiệt có để lại lời nhắn: 'Chiều 5 giờ con tan làm ghé thăm mẹ, mẹ đừng nấu cơm nhé'. Con sẽ nhắc Mẹ trước khi Tuấn Kiệt tới ạ!",
  },
  {
    label: "🎵 Kể chuyện / Nghe nhạc",
    elderlyText: "Kể cho tôi nghe một mẩu chuyện vui đi",
    response: "Dạ vâng Mẹ nghe nhé: 'Có một người đi khám bác sĩ, bác sĩ dặn mỗi ngày phải đi bộ 5 cây số. Một tháng sau gọi: Bác sĩ ơi, giờ tôi đang ở cách nhà 150 cây thì làm sao về nhà?'... Chúc Mẹ luôn vui tươi mỗi ngày ạ!",
  },
];

const QUICK_PROMPTS_EN = [
  {
    label: "🌤️ Today's Weather",
    elderlyText: "LUMO, what is the weather like today?",
    response: "Good morning! Today in Hanoi it is sunny and 28°C with a gentle breeze. Remember to drink enough water and enjoy a light walk on the balcony!",
  },
  {
    label: "💊 Medication Schedule",
    elderlyText: "What medications do I need to take today?",
    response: "This morning at 9:00 AM you took Amlodipine and Glucosamine. The next dose is at 7:00 PM after dinner for your eye supplement!",
  },
  {
    label: "💌 Family Messages",
    elderlyText: "Did my family leave any messages today?",
    response: "Yes! Tuan Kiet left a note: 'I will finish work and visit Mom around 5 PM, please do not cook dinner'. I will remind you before he arrives!",
  },
  {
    label: "🎵 Tell a story / Joke",
    elderlyText: "Can you tell me a cheerful short story?",
    response: "Certainly! A doctor told a patient: 'Walk 5 kilometers every day for good health.' A month later the patient calls: 'Doctor, I am now 150 km from home, how do I get back?'... Wishing you a joyful day!",
  },
];

export default function DemoVoiceCompanionModal() {
  const isEnglish = usePreferenceStore((state) => state.language === "en");
  const { activeScenarioModal, closeScenarioModal, mockVoiceDialogue, mockProfiles, demoTargetProfileId } = useDemoStore();
  const targetProfile = mockProfiles?.find(p => p.id === demoTargetProfileId) || mockProfiles?.find(p => p.type === "band") || { name: "Mẹ", icon: "👵" };
  const targetName = targetProfile?.name || (isEnglish ? "Family Member" : "Mẹ");
  
  const quickPrompts = isEnglish ? QUICK_PROMPTS_EN : QUICK_PROMPTS_VI;
  const [messages, setMessages] = useState<DemoVoiceMessage[]>(mockVoiceDialogue);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isOpen = activeScenarioModal === "voice-companion";

  if (!isOpen) return null;

  const speakText = (text: string) => {
    setIsSpeaking(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = isEnglish ? "en-US" : "vi-VN";
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsSpeaking(false), 3000);
    }
  };

  const handleSendPrompt = (elderlyText: string, assistantResponse: string) => {
    const timeNow = new Date().toLocaleTimeString(isEnglish ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" });
    const userMsg: DemoVoiceMessage = {
      id: Date.now().toString(),
      speaker: "elderly",
      text: elderlyText,
      timestamp: timeNow,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsListening(true);

    setTimeout(() => {
      setIsListening(false);
      const botMsg: DemoVoiceMessage = {
        id: (Date.now() + 1).toString(),
        speaker: "assistant",
        text: assistantResponse,
        timestamp: new Date().toLocaleTimeString(isEnglish ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      speakText(assistantResponse);
    }, 700);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText.trim();
    setInputText("");

    const matched = quickPrompts.find((p) => p.elderlyText.toLowerCase().includes(query.toLowerCase()));
    const response = matched
      ? matched.response
      : isEnglish
        ? `LUMO heard you clearly: "${query}". You are always our family's top priority, rest comfortably!`
        : `Dạ LUMO nghe rõ rồi ạ: "${query}". Gia đình luôn luôn bên cạnh quan tâm chăm sóc, bạn cứ yên tâm nghỉ ngơi nhé ạ!`;

    handleSendPrompt(query, response);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl text-white flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">
                  {isEnglish ? "LUMO Voice Companion Assistant" : "Trợ lý Giọng nói LUMO Companion"}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  AI Edge Voice
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isEnglish
                  ? "Interactive 2-way AI voice companion designed for elderly care"
                  : "Tương tác giọng nói 2 chiều thân thiện với người cao tuổi"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeScenarioModal}
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            title={isEnglish ? "Close modal" : "Đóng modal"}
          >
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Voice Visualizer Waveform Bar */}
        <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/60 to-purple-950/40 p-4 border-b border-purple-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? "bg-purple-400 animate-ping" : isListening ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            <span className="text-xs text-slate-300 font-medium">
              {isSpeaking
                ? (isEnglish ? "LUMO is speaking..." : "LUMO đang phản hồi bằng giọng nói...")
                : isListening
                ? (isEnglish ? `Listening to ${targetName}...` : `Đang lắng nghe ${targetName} nói...`)
                : (isEnglish ? "LUMO Hub ready to listen" : "LUMO Hub sẵn sàng lắng nghe")}
            </span>
          </div>

          {/* Animated audio wave bars */}
          <div className="flex items-center gap-1 h-6">
            {[40, 75, 100, 60, 90, 45, 80, 55, 95, 30].map((height, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isSpeaking
                    ? "bg-purple-400 animate-pulse"
                    : isListening
                    ? "bg-amber-400"
                    : "bg-slate-600"
                }`}
                style={{
                  height: isSpeaking ? `${height}%` : isListening ? `${(height % 40) + 20}%` : "20%",
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Message Dialogue List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 max-h-[420px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.speaker === "elderly" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.speaker === "elderly"
                    ? "bg-emerald-600 text-white"
                    : "bg-purple-600 text-white"
                }`}
              >
                {msg.speaker === "elderly" ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                className={`max-w-[78%] rounded-2xl p-3.5 text-sm ${
                  msg.speaker === "elderly"
                    ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-100 rounded-tr-none"
                    : "bg-slate-800/90 border border-purple-500/30 text-slate-100 rounded-tl-none"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-70">
                  <span className="font-semibold">
                    {msg.speaker === "elderly" ? (isEnglish ? `${targetName} (76 yrs)` : `${targetName} (76 tuổi)`) : (isEnglish ? "LUMO AI" : "Trợ lý LUMO")}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Pitch Prompts */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles size={13} className="text-purple-400" />
            {isEnglish ? "Sample Voice Prompts (Click to test):" : "Kịch bản hội thoại mẫu (Nhấn để demo trực tiếp):"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendPrompt(p.elderlyText, p.response)}
                className="text-left text-xs p-2 rounded-xl bg-slate-800 hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500/40 transition-all text-slate-200 truncate"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Input Box */}
        <form onSubmit={handleManualSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsListening(!isListening);
              if (!isListening) {
                handleSendPrompt(
                  isEnglish ? "Hey LUMO, are you there?" : "LUMO ơi, con có ở đó không?",
                  isEnglish ? "Yes, I am always here with you! How can I assist you?" : "Dạ con luôn ở đây cạnh Mẹ ạ! Mẹ cần con giúp gì nào?"
                );
              }
            }}
            className={`p-2.5 rounded-xl border transition-all ${
              isListening
                ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500"
            }`}
            title={isEnglish ? "Simulate voice talk" : "Mô phỏng nói chuyện"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isEnglish ? "Type a prompt or choose a sample above..." : "Nhập câu hỏi hoặc chọn kịch bản mẫu ở trên..."}
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-all"
            title={isEnglish ? "Send" : "Gửi"}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
