"use client";

import { useEffect } from "react";
import { usePreferenceStore } from "@/store/preferenceStore";

export default function PreferenceSync() {
  const { language, theme } = usePreferenceStore();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [language, theme]);

  return null;
}
