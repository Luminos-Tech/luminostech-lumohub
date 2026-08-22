import type { MockProfile } from "@/types/demo";
import type { FamilyPreset } from "./store";

export const DEMO_SYNC_CHANNEL_NAME = "lumo_demo_sync";

export type DemoSyncPayload =
  | { type: "TRIGGER_FALL" }
  | { type: "DISMISS_FALL" }
  | { type: "TRIGGER_MEDICATION" }
  | { type: "TRIGGER_VOICE" }
  | { type: "TRIGGER_CHECKIN" }
  | { type: "SET_BATTERY"; value: number }
  | { type: "SET_STEPS"; value: number }
  | { type: "SET_ACTIVITY"; value: number }
  | { type: "SET_NETWORK"; value: "4g" | "wifi" | "offline" }
  | { type: "SET_HUB_ONLINE"; value: boolean }
  | { type: "SET_BAND_CONNECTED"; value: boolean }
  | { type: "SET_DEMO_MODE"; value: boolean }
  | { type: "SET_FAMILY_PRESET"; value: FamilyPreset }
  | { type: "SET_DEMO_TARGET_PROFILE_ID"; value: string }
  | { type: "UPDATE_PERSON_PROFILE"; id: string; updates: Partial<MockProfile> }
  | { type: "SET_MOCK_PROFILE_META"; meta: Partial<{ address: string; caregiver: string; devicesText: string }> }
  | { type: "SET_MOCK_CHECKIN_DAYS"; value: number }
  | { type: "SET_MOCK_USER"; updates: any }
  | { type: "SET_STEPS"; value: number }
  | { type: "SET_FALL_DETECTED"; value: boolean | undefined }
  | { type: "SET_ACTIVE_DASHBOARD_PROFILE_ID"; value: string }
  | { type: "CLOSE_SCENARIO_MODAL" }
  | { type: "MARK_MOCK_NOTIF_READ"; id: number }
  | { type: "MARK_ALL_MOCK_NOTIFS_READ" }
  | { type: "RESET_TO_DEFAULT" }
  | { type: "CUSTOM_PUSH"; title: string; body: string; channel?: string; iconType?: "check" | "med" | "battery" | "wifi" | "bell" };

export function sendDemoSyncEvent(payload: DemoSyncPayload) {
  if (typeof window !== "undefined" && window.BroadcastChannel) {
    const bc = new BroadcastChannel(DEMO_SYNC_CHANNEL_NAME);
    bc.postMessage(payload);
    bc.close(); // Close right after sending to avoid memory leaks
  }
}
