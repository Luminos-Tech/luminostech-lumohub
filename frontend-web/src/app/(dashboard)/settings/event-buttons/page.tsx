"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AudioLines,
  BellRing,
  HandHeart,
  HeartPulse,
  Mic2,
  Pause,
  Pill,
  Play,
  Radio,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePreferenceStore } from "@/store/preferenceStore";
import {
  listVoiceRecordings,
  removeVoiceRecording,
  saveVoiceRecording,
  type StoredVoiceRecording,
  type VoiceRecordingKey,
} from "@/lib/voiceRecordings";

const VOICE_KEYS: VoiceRecordingKey[] = ["greeting", "health", "checkin", "medicine"];
const MAX_RECORDING_MS = 30_000;

function emptyRecordings(): Record<VoiceRecordingKey, StoredVoiceRecording | null> {
  return { greeting: null, health: null, checkin: null, medicine: null };
}

function emptyUrls(): Record<VoiceRecordingKey, string | null> {
  return { greeting: null, health: null, checkin: null, medicine: null };
}

function formatDuration(durationMs: number) {
  return `0:${Math.max(1, Math.ceil(durationMs / 1000)).toString().padStart(2, "0")}`;
}

export default function VoiceMessagesPage() {
  const language = usePreferenceStore((state) => state.language);
  const isEnglish = language === "en";
  const [recordings, setRecordings] = useState(emptyRecordings);
  const [audioUrls, setAudioUrls] = useState(emptyUrls);
  const [activeKey, setActiveKey] = useState<VoiceRecordingKey | null>(null);
  const [playingKey, setPlayingKey] = useState<VoiceRecordingKey | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef(audioUrls);

  const text = isEnglish
    ? {
        title: "Voice messages",
        complete: "recordings ready",
        waitingSync: "Waiting for Hub sync",
        recorded: "Recorded",
        empty: "Not recorded",
        record: "Record",
        rerecord: "Record again",
        stop: "Stop",
        play: "Play",
        pause: "Pause",
        remove: "Delete recording",
        saved: "Recording saved",
        deleted: "Recording deleted",
        micError: "Microphone access is unavailable",
        storageError: "Could not open the voice library",
        greeting: { name: "Hello", prompt: "Hello Mom and Dad, wishing you a lovely day.", moment: "Morning greeting" },
        health: { name: "Health", prompt: "How are you feeling today? Remember to rest.", moment: "Daily check-in" },
        checkin: { name: "Check-in reminder", prompt: "Please check in so the family knows you are well.", moment: "When check-in is late" },
        medicine: { name: "Take medicine", prompt: "It is time for your medicine. Please take the correct dose.", moment: "Medication time" },
      }
    : {
        title: "Lời nhắn cho Lumo",
        complete: "bản ghi đã sẵn sàng",
        waitingSync: "Chờ đồng bộ với Hub",
        recorded: "Đã ghi",
        empty: "Chưa ghi",
        record: "Ghi âm",
        rerecord: "Ghi lại",
        stop: "Dừng",
        play: "Nghe thử",
        pause: "Tạm dừng",
        remove: "Xóa bản ghi",
        saved: "Đã lưu bản ghi",
        deleted: "Đã xóa bản ghi",
        micError: "Không thể truy cập micro",
        storageError: "Không thể mở thư viện giọng nói",
        greeting: { name: "Xin chào", prompt: "Chào ba mẹ, chúc ba mẹ một ngày thật vui.", moment: "Lời chào buổi sáng" },
        health: { name: "Sức khỏe", prompt: "Hôm nay ba mẹ thấy trong người thế nào? Nhớ nghỉ ngơi nhé.", moment: "Hỏi thăm mỗi ngày" },
        checkin: { name: "Nhắc điểm danh", prompt: "Ba mẹ nhớ điểm danh để cả nhà yên tâm nhé.", moment: "Khi chưa điểm danh" },
        medicine: { name: "Uống thuốc", prompt: "Đến giờ uống thuốc rồi, ba mẹ nhớ uống đúng liều nhé.", moment: "Theo lịch uống thuốc" },
      };

  const slots = [
    { key: "greeting" as const, icon: HandHeart, accent: "coral", ...text.greeting },
    { key: "health" as const, icon: HeartPulse, accent: "green", ...text.health },
    { key: "checkin" as const, icon: BellRing, accent: "sky", ...text.checkin },
    { key: "medicine" as const, icon: Pill, accent: "gold", ...text.medicine },
  ];

  useEffect(() => {
    urlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    let cancelled = false;
    void listVoiceRecordings()
      .then((stored) => {
        if (cancelled) return;
        const nextRecordings = emptyRecordings();
        const nextUrls = emptyUrls();
        stored.forEach((recording) => {
          nextRecordings[recording.key] = recording;
          nextUrls[recording.key] = URL.createObjectURL(recording.blob);
        });
        setRecordings(nextRecordings);
        setAudioUrls(nextUrls);
      })
      .catch(() => toast.error(text.storageError));

    return () => {
      cancelled = true;
      Object.values(urlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      playbackRef.current?.pause();
    };
  }, [text.storageError]);

  const clearTimers = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    timerRef.current = null;
    stopTimerRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    clearTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = async (key: VoiceRecordingKey) => {
    if (activeKey) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder unavailable");
      }

      playbackRef.current?.pause();
      setPlayingKey(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const startedAt = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const durationMs = Math.min(Date.now() - startedAt, MAX_RECORDING_MS);
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        clearTimers();
        stopStream();
        recorderRef.current = null;
        setActiveKey(null);
        setElapsedMs(0);
        if (blob.size === 0) return;

        const recording: StoredVoiceRecording = {
          key,
          blob,
          mimeType: blob.type,
          durationMs,
          updatedAt: new Date().toISOString(),
        };
        void saveVoiceRecording(recording)
          .then(() => {
            const nextUrl = URL.createObjectURL(blob);
            setAudioUrls((current) => {
              if (current[key]) URL.revokeObjectURL(current[key]!);
              return { ...current, [key]: nextUrl };
            });
            setRecordings((current) => ({ ...current, [key]: recording }));
            toast.success(text.saved);
          })
          .catch(() => toast.error(text.storageError));
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setActiveKey(key);
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => setElapsedMs(Math.min(Date.now() - startedAt, MAX_RECORDING_MS)), 200);
      stopTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORDING_MS);
    } catch {
      clearTimers();
      stopStream();
      recorderRef.current = null;
      setActiveKey(null);
      toast.error(text.micError);
    }
  };

  const togglePlayback = async (key: VoiceRecordingKey) => {
    if (playingKey === key) {
      playbackRef.current?.pause();
      setPlayingKey(null);
      return;
    }
    const url = audioUrls[key];
    if (!url) return;
    playbackRef.current?.pause();
    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.onended = () => setPlayingKey(null);
    try {
      await audio.play();
      setPlayingKey(key);
    } catch {
      setPlayingKey(null);
    }
  };

  const deleteRecording = async (key: VoiceRecordingKey) => {
    if (activeKey === key) stopRecording();
    if (playingKey === key) {
      playbackRef.current?.pause();
      setPlayingKey(null);
    }
    try {
      await removeVoiceRecording(key);
      setRecordings((current) => ({ ...current, [key]: null }));
      setAudioUrls((current) => {
        if (current[key]) URL.revokeObjectURL(current[key]!);
        return { ...current, [key]: null };
      });
      toast.success(text.deleted);
    } catch {
      toast.error(text.storageError);
    }
  };

  const completedCount = VOICE_KEYS.filter((key) => recordings[key]).length;

  return (
    <main className="voice-library-page">
      <header className="voice-library-heading">
        <div>
          <p className="lumo-kicker">LUMO HUB</p>
          <h1>{text.title}</h1>
        </div>
        <span className="voice-completion"><AudioLines size={18} /> {completedCount}/4</span>
      </header>

      <section className="voice-sync-status" aria-label={text.waitingSync}>
        <span><Radio size={20} /></span>
        <div><strong>{completedCount}/4 {text.complete}</strong><small>{text.waitingSync}</small></div>
        <i style={{ "--voice-progress": `${completedCount * 25}%` } as CSSProperties} />
      </section>

      <section className="voice-slot-list">
        {slots.map((slot, slotIndex) => {
          const recording = recordings[slot.key];
          const isRecording = activeKey === slot.key;
          const isPlaying = playingKey === slot.key;
          return (
            <article key={slot.key} className={`voice-slot-card ${slot.accent} ${isRecording ? "recording" : ""}`}>
              <div className="voice-slot-head">
                <span className="voice-slot-icon"><slot.icon size={24} /></span>
                <div>
                  <small>0{slotIndex + 1}</small>
                  <h2>{slot.name}</h2>
                  <p>{slot.moment}</p>
                </div>
                <span className={`voice-slot-state ${recording ? "ready" : ""}`}>
                  {isRecording ? formatDuration(elapsedMs) : recording ? `${text.recorded} · ${formatDuration(recording.durationMs)}` : text.empty}
                </span>
              </div>

              <blockquote>{slot.prompt}</blockquote>

              <div className={`voice-waveform ${isRecording || isPlaying ? "active" : ""}`} aria-hidden="true">
                {Array.from({ length: 22 }, (_, index) => <span key={index} style={{ height: `${8 + ((index * 7) % 19)}px` }} />)}
              </div>

              <div className="voice-slot-actions">
                {recording && !isRecording && (
                  <button type="button" className="voice-play-button" onClick={() => void togglePlayback(slot.key)}>
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {isPlaying ? text.pause : text.play}
                  </button>
                )}
                <button
                  type="button"
                  className={`voice-record-button ${isRecording ? "stop" : ""}`}
                  disabled={Boolean(activeKey && !isRecording)}
                  onClick={() => isRecording ? stopRecording() : void startRecording(slot.key)}
                >
                  {isRecording ? <Square size={17} fill="currentColor" /> : <Mic2 size={18} />}
                  {isRecording ? text.stop : recording ? text.rerecord : text.record}
                </button>
                {recording && !isRecording && (
                  <button type="button" className="voice-delete-button" onClick={() => void deleteRecording(slot.key)} aria-label={text.remove} title={text.remove}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
