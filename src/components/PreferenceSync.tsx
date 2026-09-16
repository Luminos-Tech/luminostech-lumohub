"use client";

import { useEffect } from "react";
import { usePreferenceStore } from "@/store/preferenceStore";

export default function PreferenceSync() {
  const { language, theme } = usePreferenceStore();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [language, theme]);

  return null;
}
