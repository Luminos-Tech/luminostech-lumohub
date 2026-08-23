import { useDemoStore } from "@/demo/store";
import { OPEN_DEMO_DRAWER_EVENT } from "@/lib/uiEvents";

let clickCounter = 0;
let lastClickTimer: ReturnType<typeof setTimeout> | null = null;
let lastRegisteredEventTime = 0;

export function openSecretDemoConsole(e?: React.SyntheticEvent | MouseEvent | TouchEvent | PointerEvent) {
  if (e && "preventDefault" in e && typeof e.preventDefault === "function") {
    e.preventDefault();
    e.stopPropagation();
  }
  clickCounter = 0;
  if (lastClickTimer) {
    clearTimeout(lastClickTimer);
  }
  
  if (typeof window !== "undefined") {
    window.open("/demo-controller", "_blank");
  }
}

export function registerLogoTap(e?: React.SyntheticEvent | MouseEvent | TouchEvent | PointerEvent) {
  const now = Date.now();

  // If in stealth mode, ignore logo taps entirely
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stealth") === "true") {
    return;
  }

  // Prevent duplicate synthetic events from a single tap
  if (now - lastRegisteredEventTime < 70) {
    return;
  }
  lastRegisteredEventTime = now;

  clickCounter += 1;

  if (lastClickTimer) {
    clearTimeout(lastClickTimer);
  }

  // 2 clicks / taps opens the Demo Console panel only
  if (clickCounter >= 2) {
    openSecretDemoConsole(e);
    return;
  }

  // Reset counter after 1.5 seconds of inactivity
  lastClickTimer = setTimeout(() => {
    clickCounter = 0;
  }, 1500);
}
