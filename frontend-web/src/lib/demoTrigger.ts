import { useDemoStore } from "@/store/demoStore";
import { OPEN_DEMO_DRAWER_EVENT } from "./uiEvents";

let clickCounter = 0;
let lastClickTimer: ReturnType<typeof setTimeout> | null = null;
let lastRegisteredEventTime = 0;

export function registerLogoTap(e?: React.SyntheticEvent | MouseEvent | TouchEvent | PointerEvent) {
  const now = Date.now();

  // Prevent multiple events from the same tap (e.g. pointerdown + click firing together within 100ms)
  if (now - lastRegisteredEventTime < 100) {
    return;
  }
  lastRegisteredEventTime = now;

  clickCounter += 1;

  if (lastClickTimer) {
    clearTimeout(lastClickTimer);
  }

  if (clickCounter >= 3) {
    if (e && "preventDefault" in e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    clickCounter = 0;
    
    // Enable demo mode & open drawer directly
    useDemoStore.getState().enableDemoMode();
    useDemoStore.getState().setDrawerOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_DEMO_DRAWER_EVENT));
    return;
  }

  // Reset counter after 1.8 seconds of inactivity
  lastClickTimer = setTimeout(() => {
    clickCounter = 0;
  }, 1800);
}
