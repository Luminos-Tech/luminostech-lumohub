"use client";

import { Toaster } from "sonner";
import { usePreferenceStore } from "@/store/preferenceStore";

const baseToastClass = "rounded-2xl shadow-2xl border-2 bg-white border-slate-200 text-slate-800 dark:text-white";

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
          default: `${baseToastClass} dark:bg-[#102a31] dark:border-sky-500/30`,
          title: "font-bold text-sm",
          description: "text-xs mt-0.5 opacity-90",
          info: `${baseToastClass} dark:bg-[#101b31] dark:border-blue-500/30`,
          success: `${baseToastClass} dark:bg-[#102a31] dark:border-emerald-500/30`,
          error: `${baseToastClass} dark:bg-[#2a1010] dark:border-red-500/30`,
          warning: `${baseToastClass} dark:bg-[#2a2010] dark:border-amber-500/30`,
        }
      }}
    />
  );
}
