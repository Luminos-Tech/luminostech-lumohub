"use client";

import { Toaster } from "sonner";
import { usePreferenceStore } from "@/store/preferenceStore";

// Shared shape ONLY — no background/border/text colors here.
// Sonner's styles.css sets `background: var(--normal-bg)` as a shorthand,
// which always wins over Tailwind's `bg-*` classes (longhand), so we
// cannot override the bg via classNames. We rely on `richColors` instead.
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
      // ✅ Enable richColors so sonner applies its built-in palette
      // (success=green, info=blue, warning=amber, error=red)
      // to data-type='error' toasts. Without this, ALL toasts use
      // --normal-bg (white) regardless of Tailwind bg-red-50 class.
      richColors
      toastOptions={{
        classNames: {
          toast: `${baseToastClass} font-sans w-full`,
          title: "font-bold text-base",
          description: "text-sm mt-0.5 opacity-90",
          // Force a thicker red border on alert/error toasts (sonner only sets 1px)
          error: "!border-red-600 dark:!border-red-400",
        }
      }}
    />
  );
}
