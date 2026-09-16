"use client";

import { Toaster } from "sonner";
import { usePreferenceStore } from "@/store/preferenceStore";

// Shared shape ONLY — no background/border/text colors here,
// because every variant (default/success/error/...) must own its own color
// and Tailwind's CSS build order will otherwise make `bg-white` win over `bg-red-50`.
const baseToastClass = "rounded-2xl shadow-2xl border-2 font-sans";

export default function AppToaster() {
  const theme = usePreferenceStore((state) => state.theme);

  // Convert our theme preference to sonner's expected theme prop
  const activeTheme = theme === "dark" ? "dark" : "light";

  return (
    <Toaster
      position="top-center"
      style={{ "--width": "min(400px, calc(100vw - 32px))" } as React.CSSProperties}
      theme={activeTheme}
      toastOptions={{
        classNames: {
          toast: "font-sans w-full",
          // Light: white background; Dark: sky-tinted background
          default: `${baseToastClass} bg-white border-slate-200 text-slate-800 dark:bg-[#102a31] dark:border-sky-500/30 dark:text-white`,
          title: "font-bold text-sm",
          description: "text-xs mt-0.5 opacity-90",
          // Blue / info
          info: `${baseToastClass} bg-blue-50 border-blue-500 text-blue-900 dark:bg-[#101b31] dark:border-blue-500/30 dark:text-blue-100`,
          // Green / success
          success: `${baseToastClass} bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-[#102a31] dark:border-emerald-500/30 dark:text-emerald-100`,
          // 🔴 Red / error — used for `notification_type: "alert"`
          error: `${baseToastClass} bg-red-50 border-red-500 text-red-900 dark:bg-[#2a1010] dark:border-red-500/30 dark:text-red-100`,
          // Amber / warning
          warning: `${baseToastClass} bg-amber-50 border-amber-500 text-amber-900 dark:bg-[#2a2010] dark:border-amber-500/30 dark:text-amber-100`,
        }
      }}
    />
  );
}
