import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Device, EventButton, TodayButtonStatus, User, Notification } from "@/types";
import type { MockProfile } from "@/types/demo";

export interface DemoVoiceMessage {
  id: string;
  speaker: "assistant" | "elderly";
  text: string;
  timestamp: string;
}

export type FamilyPreset = "ba_me" | "ong_ba" | "single_me" | "single_ba";

export interface DemoState {
  isDemoMode: boolean;
  isDrawerOpen: boolean;
  activeScenarioModal: "fall-alert" | "med-reminder" | "voice-companion" | null;
  
  // Hardware & Telemetry State (LUMO Band: Fall Detection & Step Counting)
  batteryLevel: number;
  activityMinutes: number;
  stepsToday: number;
  fallDetected: boolean | undefined;
  lastFallTime: string | null;
  checkedInToday: boolean;
  lastCheckInTime: string | null;
  mockCheckInDays: number;
  networkStatus: "4g" | "wifi" | "offline";
  hubOnline: boolean;
  bandConnected: boolean;

  // Multi-device profiles & Family Presets
  familyPreset: FamilyPreset;
  mockProfiles: MockProfile[];
  activeDashboardProfileId: string;
  demoTargetProfileId: string;
  
  setFamilyPreset: (preset: FamilyPreset) => void;
  setMockProfiles: (profiles: MockProfile[]) => void;
  setActiveDashboardProfileId: (id: string) => void;
  setDemoTargetProfileId: (id: string) => void;
  updateMockProfile: (id: string, data: Partial<MockProfile>) => void;
  updatePersonProfile: (id: string, updates: Partial<MockProfile>) => void;
  
  // Mock Data Sets
  mockUser: User;
  mockProfileMeta: {
    address: string;
    caregiver: string;
    devicesText: string;
  };
  mockDevice: Device;
  mockTodayStatus: TodayButtonStatus;
  mockRecentEvents: EventButton[];
  mockNotifications: Notification[];
  mockVoiceDialogue: DemoVoiceMessage[];

  // Actions
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  toggleDemoMode: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  openScenarioModal: (modal: "fall-alert" | "med-reminder" | "voice-companion" | null) => void;
  closeScenarioModal: () => void;

  // Scenario Triggers
  triggerFallDetection: () => void;
  dismissFallAlert: () => void;
  triggerCheckIn: () => void;
  triggerMedicationReminder: () => void;
  triggerVoiceCompanion: () => void;
  
  // Hardware Sliders
  setBatteryLevel: (val: number) => void;
  setActivityMinutes: (val: number) => void;
  setStepsToday: (val: number) => void;
  setNetworkStatus: (status: "4g" | "wifi" | "offline") => void;
  setHubOnline: (online: boolean) => void;
  setBandConnected: (connected: boolean) => void;
  setFallDetected: (val: boolean | undefined) => void;
  setMockCheckInDays: (days: number) => void;
  setMockUser: (user: Partial<User>) => void;
  setMockProfileMeta: (meta: Partial<{ address: string; caregiver: string; devicesText: string }>) => void;
  markMockNotificationRead: (id: number) => void;
  markAllMockNotificationsRead: () => void;

  resetToDefault: () => void;
}

const DEFAULT_MOCK_USER: User = {
  id: 999,
  full_name: "Cụ Nguyễn Thị Mai",
  email: "mai.nguyen@luminostech.vn",
  phone: "0912 345 678",
  avatar_url: "",
  role: "user",
  is_active: true,
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-08-20T08:00:00Z",
};

const DEFAULT_MOCK_DEVICE: Device = {
  id: 1,
  user_id: 999,
  device_id: "LH-8821",
  is_active: true,
  battery_level: 88,
  fall_detected: false,
  last_fall_at: null,
  activity_minutes_today: 45,
  last_activity_at: new Date().toISOString(),
  created_at: "2024-02-01T10:00:00Z",
  updated_at: new Date().toISOString(),
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 101,
    user_id: 999,
    title: "Chạm xác nhận an tâm trên LUMO Band",
    content: "Mẹ đã chạm mặt cảm biến trên LUMO Band để báo an tâm lúc 07:15. Con cái yên tâm đi làm.",
    channel: "lumo",
    is_read: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 102,
    user_id: 999,
    title: "Nhắc nhở uống thuốc hoàn thành",
    content: "LUMO Hub đã phát lời nhắc: 'Mẹ nhớ uống 1 viên thuốc huyết áp sau ăn sáng'.",
    channel: "lumo",
    is_read: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 103,
    user_id: 999,
    title: "LUMO Band hoạt động ổn định",
    content: "Pin vòng đeo tay đạt 88%, kết nối liên tục 24/7 bảo vệ Cha Mẹ.",
    channel: "mobile",
    is_read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const DEFAULT_VOICE_DIALOGUE: DemoVoiceMessage[] = [
  {
    id: "1",
    speaker: "elderly",
    text: "LUMO ơi, hôm nay thời tiết thế nào hả con?",
    timestamp: "08:15",
  },
  {
    id: "2",
    speaker: "assistant",
    text: "Dạ thưa Mẹ, hôm nay trời nắng ráo mát mẻ 28°C. Mẹ nhớ uống đủ nước và vận động nhẹ nhàng nhé ạ!",
    timestamp: "08:15",
  },
  {
    id: "3",
    speaker: "elderly",
    text: "Cảm ơn LUMO, tí nữa con có ghé thăm không?",
    timestamp: "08:16",
  },
  {
    id: "4",
    speaker: "assistant",
    text: "Dạ con vừa nhắn trên App: 'Chiều 5 giờ con tan làm ghé mua cháo cho Mẹ'. Con sẽ nhắc Mẹ trước khi con đến nhé!",
    timestamp: "08:16",
  },
];

export const PRESET_PROFILES: Record<FamilyPreset, MockProfile[]> = {
  ba_me: [
    {
      id: "overview",
      name: "Tổng quan",
      type: "overview",
      icon: "🏠",
    },
    {
      id: "profile_1",
      name: "Mẹ",
      fullName: "Cụ Nguyễn Thị Mai",
      address: "Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội",
      caregiver: "Anh Trí (Con trai - 0988 123 456)",
      phone: "0912 345 678",
      age: "76 tuổi (1948)",
      type: "band",
      icon: "👵",
      device_id: "LH-8821",
      batteryLevel: 88,
      activityMinutes: 45,
      fallDetected: false,
      checkedInToday: true,
      lastCheckInTime: "07:15",
    },
    {
      id: "profile_2",
      name: "Ba",
      fullName: "Cụ Nguyễn Văn Hùng",
      address: "Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội",
      caregiver: "Anh Trí (Con trai - 0988 123 456)",
      phone: "0903 888 999",
      age: "79 tuổi (1945)",
      type: "band",
      icon: "👴",
      device_id: "LH-8822",
      batteryLevel: 25,
      activityMinutes: 12,
      fallDetected: false,
      checkedInToday: false,
      lastCheckInTime: null,
    },
    {
      id: "hub_1",
      name: "LUMO Hub",
      type: "hub",
      icon: "🏡",
      device_id: "LB-100",
      hubOnline: true,
    },
  ],
  ong_ba: [
    {
      id: "overview",
      name: "Tổng quan",
      type: "overview",
      icon: "🏠",
    },
    {
      id: "profile_1",
      name: "Bà",
      fullName: "Cụ Trần Thị Năm",
      address: "Số 24 Đường Bưởi, Ba Đình, Hà Nội",
      caregiver: "Cháu Minh (Cháu nội - 0912 999 888)",
      phone: "0918 222 333",
      age: "82 tuổi (1942)",
      type: "band",
      icon: "👵",
      device_id: "LH-8821",
      batteryLevel: 92,
      activityMinutes: 50,
      fallDetected: false,
      checkedInToday: true,
      lastCheckInTime: "06:45",
    },
    {
      id: "profile_2",
      name: "Ông",
      fullName: "Cụ Lê Văn Tư",
      address: "Số 24 Đường Bưởi, Ba Đình, Hà Nội",
      caregiver: "Cháu Minh (Cháu nội - 0912 999 888)",
      phone: "0908 666 777",
      age: "84 tuổi (1940)",
      type: "band",
      icon: "👴",
      device_id: "LH-8822",
      batteryLevel: 40,
      activityMinutes: 30,
      fallDetected: false,
      checkedInToday: true,
      lastCheckInTime: "08:10",
    },
    {
      id: "hub_1",
      name: "LUMO Hub",
      type: "hub",
      icon: "🏡",
      device_id: "LB-100",
      hubOnline: true,
    },
  ],
  single_me: [
    {
      id: "profile_1",
      name: "Mẹ",
      fullName: "Cụ Nguyễn Thị Mai",
      address: "Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội",
      caregiver: "Anh Trí (Con trai - 0988 123 456)",
      phone: "0912 345 678",
      age: "76 tuổi (1948)",
      type: "band",
      icon: "👵",
      device_id: "LH-8821",
      batteryLevel: 88,
      activityMinutes: 45,
      fallDetected: false,
      checkedInToday: true,
      lastCheckInTime: "07:15",
    },
    {
      id: "hub_1",
      name: "LUMO Hub",
      type: "hub",
      icon: "🏡",
      device_id: "LB-100",
      hubOnline: true,
    },
  ],
  single_ba: [
    {
      id: "profile_1",
      name: "Bà",
      fullName: "Cụ Trần Thị Năm",
      address: "Số 24 Đường Bưởi, Ba Đình, Hà Nội",
      caregiver: "Cháu Minh (Cháu nội - 0912 999 888)",
      phone: "0918 222 333",
      age: "82 tuổi (1942)",
      type: "band",
      icon: "👵",
      device_id: "LH-8821",
      batteryLevel: 92,
      activityMinutes: 50,
      fallDetected: false,
      checkedInToday: true,
      lastCheckInTime: "06:45",
    },
    {
      id: "hub_1",
      name: "LUMO Hub",
      type: "hub",
      icon: "🏡",
      device_id: "LB-100",
      hubOnline: true,
    },
  ],
};

export const formatDisplayPersonName = (name: string, isEnglish: boolean = false): string => {
  if (!name) return "";
  const trimmed = name.trim();
  if (/^mẹ/i.test(trimmed) || /^mother/i.test(trimmed) || /^mom/i.test(trimmed)) {
    return isEnglish ? "Mother" : "Mẹ";
  }
  if (/^ba/i.test(trimmed) || /^bố/i.test(trimmed) || /^father/i.test(trimmed) || /^dad/i.test(trimmed)) {
    return isEnglish ? "Father" : "Ba";
  }
  if (/^bà/i.test(trimmed) || /^grandmother/i.test(trimmed) || /^grandma/i.test(trimmed)) {
    return isEnglish ? "Grandma" : "Bà";
  }
  if (/^ông/i.test(trimmed) || /^grandfather/i.test(trimmed) || /^grandpa/i.test(trimmed)) {
    return isEnglish ? "Grandpa" : "Ông";
  }
  if (/^tổng quan/i.test(trimmed) || /^overview/i.test(trimmed)) {
    return isEnglish ? "Overview" : "Tổng quan";
  }
  return trimmed;
};

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      isDemoMode: true,
      isDrawerOpen: false,
      activeScenarioModal: null,

      batteryLevel: 88,
      activityMinutes: 45,
      stepsToday: 3840,
      fallDetected: false,
      lastFallTime: null,
      checkedInToday: true,
      lastCheckInTime: "07:15",
      mockCheckInDays: 6,
      networkStatus: "4g",
      hubOnline: true,
      bandConnected: true,
      
      familyPreset: "ba_me",
      mockProfiles: PRESET_PROFILES.ba_me,
      activeDashboardProfileId: "overview",
      demoTargetProfileId: "profile_1",

      mockUser: DEFAULT_MOCK_USER,
      mockProfileMeta: {
        address: "Ba Đình, Hà Nội",
        caregiver: "Anh Trí (Con trai)",
        devicesText: "LUMO Hub 4G + 2 LUMO Bands (LH-8821 & LH-8822)"
      },
      mockDevice: DEFAULT_MOCK_DEVICE,
      mockTodayStatus: {
        clicked_today: true,
        last_click_at: new Date().toISOString(),
        total_today: 1,
      },
      mockRecentEvents: [
        {
          id: 1,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 3,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date(Date.now() - 172800000).toISOString(),
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 4,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date(Date.now() - 259200000).toISOString(),
          created_at: new Date(Date.now() - 259200000).toISOString(),
        },
        {
          id: 5,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date(Date.now() - 345600000).toISOString(),
          created_at: new Date(Date.now() - 345600000).toISOString(),
        },
        {
          id: 6,
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date(Date.now() - 432000000).toISOString(),
          created_at: new Date(Date.now() - 432000000).toISOString(),
        },
      ],
      mockNotifications: INITIAL_NOTIFICATIONS,
      mockVoiceDialogue: DEFAULT_VOICE_DIALOGUE,

      enableDemoMode: () => set({ isDemoMode: true }),
      disableDemoMode: () => set({ isDemoMode: false, isDrawerOpen: false, activeScenarioModal: null }),
      toggleDemoMode: () => set((s) => ({ isDemoMode: !s.isDemoMode })),
      setDrawerOpen: (open) => set({ isDrawerOpen: open }),
      toggleDrawer: () => set((s) => ({ isDrawerOpen: !s.isDrawerOpen })),
      openScenarioModal: (modal) => set({ activeScenarioModal: modal }),
      closeScenarioModal: () => set({ activeScenarioModal: null }),

      setFamilyPreset: (preset) => {
        const newProfiles = PRESET_PROFILES[preset];
        const isSingle = preset.startsWith("single_");
        set({
          familyPreset: preset,
          mockProfiles: newProfiles,
          activeDashboardProfileId: isSingle ? "profile_1" : "overview",
          demoTargetProfileId: "profile_1",
          mockProfileMeta: {
            address: "Ba Đình, Hà Nội",
            caregiver: preset === "ong_ba" ? "Cháu Minh (Cháu nội)" : "Anh Trí (Con trai)",
            devicesText: isSingle ? "LUMO Hub 4G + LUMO Band (LH-8821)" : "LUMO Hub 4G + 2 LUMO Bands (LH-8821 & LH-8822)"
          }
        });
      },

      setMockProfiles: (profiles) => set({ mockProfiles: profiles }),
      setActiveDashboardProfileId: (id) => set({ activeDashboardProfileId: id }),
      setDemoTargetProfileId: (id) => set({ demoTargetProfileId: id }),
      
      updateMockProfile: (id, data) => set((state) => {
        const updated = state.mockProfiles.map(p => p.id === id ? { ...p, ...data } : p);
        const target = updated.find(p => p.id === id);
        return {
          mockProfiles: updated,
          ...(id === state.demoTargetProfileId && target ? {
            batteryLevel: target.batteryLevel ?? state.batteryLevel,
            activityMinutes: target.activityMinutes ?? state.activityMinutes,
            fallDetected: target.fallDetected ?? state.fallDetected,
            checkedInToday: target.checkedInToday ?? state.checkedInToday,
            lastCheckInTime: target.lastCheckInTime ?? state.lastCheckInTime,
          } : {})
        };
      }),

      updatePersonProfile: (id, updates) => set((state) => {
        const updated = state.mockProfiles.map(p => p.id === id ? { ...p, ...updates } : p);
        const target = updated.find(p => p.id === id);
        return {
          mockProfiles: updated,
          ...(id === state.demoTargetProfileId && target ? {
            batteryLevel: target.batteryLevel ?? state.batteryLevel,
            activityMinutes: target.activityMinutes ?? state.activityMinutes,
            fallDetected: target.fallDetected ?? state.fallDetected,
            checkedInToday: target.checkedInToday ?? state.checkedInToday,
            lastCheckInTime: target.lastCheckInTime ?? state.lastCheckInTime,
          } : {})
        };
      }),

      triggerFallDetection: () => {
        const nowStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const { demoTargetProfileId, mockProfiles } = get();
        const targetProfile = mockProfiles.find(p => p.id === demoTargetProfileId) || mockProfiles.find(p => p.type === "band") || { name: "Mẹ", device_id: "LH-8821" };
        
        const newNotif: Notification = {
          id: Date.now(),
          user_id: 999,
          title: "🚨 KHẨN CẤP: PHÁT HIỆN TÉ NGÃ",
          content: `LUMO Band phát hiện ${targetProfile.name} bị té ngã và không chạm xác nhận an toàn lúc ${nowStr}. Vui lòng kiểm tra ngay!`,
          channel: "lumo",
          is_read: false,
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          fallDetected: true,
          lastFallTime: nowStr,
          activeScenarioModal: "fall-alert",
          mockNotifications: [newNotif, ...s.mockNotifications],
          mockProfiles: s.mockProfiles.map(p => p.id === demoTargetProfileId ? { ...p, fallDetected: true } : p),
          mockDevice: {
            ...s.mockDevice,
            fall_detected: true,
            last_fall_at: new Date().toISOString(),
          },
        }));
      },

      dismissFallAlert: () => {
        const { demoTargetProfileId } = get();
        set((s) => ({
          fallDetected: false,
          activeScenarioModal: null,
          mockProfiles: s.mockProfiles.map(p => p.id === demoTargetProfileId ? { ...p, fallDetected: false } : p),
          mockDevice: {
            ...s.mockDevice,
            fall_detected: false,
          },
        }));
      },

      triggerCheckIn: () => {
        const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const { demoTargetProfileId, mockProfiles } = get();
        const targetProfile = mockProfiles.find(p => p.id === demoTargetProfileId) || mockProfiles.find(p => p.type === "band") || { name: "Mẹ", device_id: "LH-8821" };

        const newClick: EventButton = {
          id: Date.now(),
          device_id: 1,
          device_code: targetProfile.device_id || "LH-8821",
          user_id: 999,
          time_button_click: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        const checkinNotif: Notification = {
          id: Date.now(),
          user_id: 999,
          title: "Chạm xác nhận an tâm trên LUMO Band",
          content: `${targetProfile.name} vừa chạm xác nhận an tâm trên LUMO Band lúc ${timeStr}. Con cái nhận thông báo an tâm từ xa!`,
          channel: "lumo",
          is_read: false,
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          checkedInToday: true,
          lastCheckInTime: timeStr,
          mockRecentEvents: [newClick, ...s.mockRecentEvents],
          mockNotifications: [checkinNotif, ...s.mockNotifications],
          mockProfiles: s.mockProfiles.map(p => p.id === demoTargetProfileId ? { ...p, checkedInToday: true, lastCheckInTime: timeStr } : p),
          mockTodayStatus: {
            clicked_today: true,
            last_click_at: new Date().toISOString(),
            total_today: (s.mockTodayStatus?.total_today || 0) + 1,
          },
        }));
      },

      triggerMedicationReminder: () => {
        set({ activeScenarioModal: "med-reminder" });
      },

      triggerVoiceCompanion: () => {
        set({ activeScenarioModal: "voice-companion" });
      },

      setBatteryLevel: (val) =>
        set((s) => ({
          batteryLevel: val,
          mockProfiles: s.mockProfiles.map(p => p.id === s.demoTargetProfileId ? { ...p, batteryLevel: val } : p),
          mockDevice: { ...s.mockDevice, battery_level: val },
        })),

      setActivityMinutes: (val) =>
        set((s) => ({
          activityMinutes: val,
          mockProfiles: s.mockProfiles.map(p => p.id === s.demoTargetProfileId ? { ...p, activityMinutes: val } : p),
          mockDevice: { ...s.mockDevice, activity_minutes_today: val },
        })),
      setStepsToday: (val) => set({ stepsToday: val }),

      setFallDetected: (val) => set((s) => ({ 
        fallDetected: val,
        mockProfiles: s.mockProfiles.map(p => p.id === s.demoTargetProfileId ? { ...p, fallDetected: val } : p),
      })),
      
      setMockCheckInDays: (days) => {
        const newEvents: EventButton[] = [];
        for (let i = 0; i < days; i++) {
          const date = new Date(Date.now() - i * 86400000);
          newEvents.push({
            id: i + 1,
            device_id: 1,
            device_code: "LH-8821",
            user_id: 999,
            time_button_click: date.toISOString(),
            created_at: date.toISOString(),
          });
        }
        set({ mockCheckInDays: days, mockRecentEvents: newEvents });
      },

      setMockUser: (userUpdates) => set((s) => ({ mockUser: { ...s.mockUser, ...userUpdates } })),
      setMockProfileMeta: (metaUpdates) => set((s) => ({ mockProfileMeta: { ...s.mockProfileMeta, ...metaUpdates } })),

      setNetworkStatus: (status) => set({ networkStatus: status }),
      setHubOnline: (online) => set((s) => ({ 
        hubOnline: online,
        mockProfiles: s.mockProfiles.map(p => p.type === 'hub' ? { ...p, hubOnline: online } : p)
      })),
      setBandConnected: (connected) => set({ bandConnected: connected }),

      markMockNotificationRead: (id) =>
        set((s) => ({
          mockNotifications: s.mockNotifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        })),

      markAllMockNotificationsRead: () =>
        set((s) => ({
          mockNotifications: s.mockNotifications.map((n) => ({ ...n, is_read: true })),
        })),

      resetToDefault: () =>
        set({
          batteryLevel: 88,
          activityMinutes: 45,
          stepsToday: 3840,
          fallDetected: false,
          lastFallTime: null,
          checkedInToday: true,
          lastCheckInTime: "07:15",
          mockCheckInDays: 6,
          networkStatus: "4g",
          hubOnline: true,
          bandConnected: true,
          activeScenarioModal: null,
          familyPreset: "ba_me",
          mockProfiles: PRESET_PROFILES.ba_me,
          activeDashboardProfileId: "overview",
          demoTargetProfileId: "profile_1",
          mockNotifications: INITIAL_NOTIFICATIONS,
        }),
    }),
    {
      name: "lumohub-demo-settings-v4",
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.mockProfiles)) {
          state.mockProfiles = state.mockProfiles.map((p) => ({
            ...p,
            name: formatDisplayPersonName(p.name),
          }));
        }
      },
      partialize: (s) => ({
        isDemoMode: s.isDemoMode,
        familyPreset: s.familyPreset,
        mockProfiles: s.mockProfiles,
        activeDashboardProfileId: s.activeDashboardProfileId,
        demoTargetProfileId: s.demoTargetProfileId,
        batteryLevel: s.batteryLevel,
        activityMinutes: s.activityMinutes,
        stepsToday: s.stepsToday,
        networkStatus: s.networkStatus,
        mockCheckInDays: s.mockCheckInDays,
        mockUser: s.mockUser,
        mockProfileMeta: s.mockProfileMeta,
        mockNotifications: s.mockNotifications,
      }),
    }
  )
);
