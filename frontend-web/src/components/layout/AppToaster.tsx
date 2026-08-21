"use client";

import { Toaster } from "sonner";
import { usePreferenceStore } from "@/store/preferenceStore";

export default function AppToaster() {
  const theme = usePreferenceStore((state) => state.theme);
  
  // Convert our theme preference to sonner's expected theme prop
  const activeTheme = theme === "dark" ? "dark" : "light";

  return (
    <Toaster 
      position="top-right"
      theme={activeTheme}
      toastOptions={{
        classNames: {
          toast: "font-sans rounded-2xl shadow-2xl border-2 dark:bg-[#102a31] dark:border-sky-500/30 dark:text-white bg-white border-slate-200 text-slate-800",
          title: "font-bold text-sm",
          description: "text-xs mt-0.5 opacity-90",
          info: "dark:bg-[#101b31] dark:border-blue-500/30",
          success: "dark:bg-[#102a31] dark:border-emerald-500/30",
          error: "dark:bg-[#2a1010] dark:border-red-500/30",
          warning: "dark:bg-[#2a2010] dark:border-amber-500/30",
        }
      }}
    />
  );
}
