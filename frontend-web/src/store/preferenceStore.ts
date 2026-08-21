"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppLanguage = "vi" | "en";
export type AppTheme = "light" | "dark";
export type LumoVoiceIdVi = "Kore" | "Aoede" | "Puck" | "Fenrir" | "Charon";
export type LumoVoiceIdEn = "Kore" | "Zephyr" | "Puck" | "Fenrir" | "Charon";
export type LumoVoiceId = LumoVoiceIdVi | LumoVoiceIdEn;

interface PreferenceState {
  language: AppLanguage;
  theme: AppTheme;
  aiVoice: LumoVoiceIdVi;
  aiVoiceEn: LumoVoiceIdEn;
  aiVoiceRate: number;
  pushEnabled: boolean;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
  setAiVoice: (voice: LumoVoiceIdVi) => void;
  setAiVoiceEn: (voice: LumoVoiceIdEn) => void;
  setAiVoiceRate: (rate: number) => void;
  setPushEnabled: (enabled: boolean) => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      language: "vi",
      theme: "light",
      aiVoice: "Kore",
      aiVoiceEn: "Kore",
      aiVoiceRate: 0.95,
      pushEnabled: false,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setAiVoice: (aiVoice) => set({ aiVoice }),
      setAiVoiceEn: (aiVoiceEn) => set({ aiVoiceEn }),
      setAiVoiceRate: (aiVoiceRate) => set({ aiVoiceRate }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
    }),
    { name: "lumohub-preferences" },
  ),
);
