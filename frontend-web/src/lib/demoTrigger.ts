import { useDemoStore } from "@/store/demoStore";
import { OPEN_DEMO_DRAWER_EVENT } from "./uiEvents";

let logoClickTimestamps: number[] = [];

export function registerLogoTap(e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) {
  const now = Date.now();
  // Keep clicks within a 1500ms window
  logoClickTimestamps = [...logoClickTimestamps.filter((t) => now - t < 1500), now];

  if (logoClickTimestamps.length >= 3) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    logoClickTimestamps = [];
    useDemoStore.getState().enableDemoMode();
    useDemoStore.getState().setDrawerOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_DEMO_DRAWER_EVENT));
  }
}
