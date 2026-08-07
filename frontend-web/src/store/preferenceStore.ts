"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppLanguage = "vi" | "en";
export type AppTheme = "light" | "dark";

interface PreferenceState {
  language: AppLanguage;
  theme: AppTheme;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      language: "vi",
      theme: "light",
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "lumohub-preferences" },
  ),
);
