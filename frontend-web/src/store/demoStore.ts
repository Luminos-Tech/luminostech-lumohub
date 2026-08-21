import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Device, EventButton, TodayButtonStatus, User, Notification } from "@/types";

export interface DemoVoiceMessage {
  id: string;
  speaker: "assistant" | "elderly";
  text: string;
  timestamp: string;
}

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
  
  // Mock Data Sets
  mockUser: User;
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
    content: "Cụ Mai đã chạm mặt cảm biến trên LUMO Band để báo an tâm lúc 07:15. Con cái yên tâm đi làm.",
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
    text: "Dạ thưa cụ Mai, hôm nay Hà Nội trời nắng ráo, nhiệt độ 28°C rất mát mẻ. Cụ nhớ uống đủ nước và đi dạo nhẹ nhàng ở ban công nhé ạ!",
    timestamp: "08:15",
  },
  {
    id: "3",
    speaker: "elderly",
    text: "Cảm ơn LUMO, tí nữa cháu Trí có ghé thăm không?",
    timestamp: "08:16",
  },
  {
    id: "4",
    speaker: "assistant",
    text: "Dạ anh Trí vừa nhắn trên App: 'Chiều 5 giờ con tan làm ghé mua cháo cho mẹ'. Con sẽ nhắc cụ trước khi anh Trí đến nhé!",
    timestamp: "08:16",
  },
];

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      isDemoMode: true, // Enabled by default for seamless pitch experience
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

      mockUser: DEFAULT_MOCK_USER,
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

      triggerFallDetection: () => {
        const nowStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const newNotif: Notification = {
          id: Date.now(),
          user_id: 999,
          title: "🚨 KHẨN CẤP: PHÁT HIỆN TÉ NGÃ",
          content: `LUMO Band phát hiện Cha/Mẹ bị té ngã và không chạm xác nhận an toàn lúc ${nowStr} tại Phòng Khách. Vui lòng kiểm tra ngay!`,
          channel: "lumo",
          is_read: false,
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          fallDetected: true,
          lastFallTime: nowStr,
          activeScenarioModal: "fall-alert",
          mockNotifications: [newNotif, ...s.mockNotifications],
          mockDevice: {
            ...s.mockDevice,
            fall_detected: true,
            last_fall_at: new Date().toISOString(),
          },
        }));
      },

      dismissFallAlert: () => {
        set((s) => ({
          fallDetected: false,
          activeScenarioModal: null,
          mockDevice: {
            ...s.mockDevice,
            fall_detected: false,
          },
        }));
      },

      triggerCheckIn: () => {
        const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const newClick: EventButton = {
          id: Date.now(),
          device_id: 1,
          device_code: "LH-8821",
          user_id: 999,
          time_button_click: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        const checkinNotif: Notification = {
          id: Date.now(),
          user_id: 999,
          title: "Chạm xác nhận an tâm trên LUMO Band",
          content: `Mẹ Mai vừa chạm xác nhận an tâm trên LUMO Band lúc ${timeStr}. Con cái nhận thông báo an tâm từ xa!`,
          channel: "lumo",
          is_read: false,
          created_at: new Date().toISOString(),
        };

        set((s) => ({
          checkedInToday: true,
          lastCheckInTime: timeStr,
          mockRecentEvents: [newClick, ...s.mockRecentEvents],
          mockNotifications: [checkinNotif, ...s.mockNotifications],
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
          mockDevice: { ...s.mockDevice, battery_level: val },
        })),

      setActivityMinutes: (val) =>
        set((s) => ({
          activityMinutes: val,
          mockDevice: { ...s.mockDevice, activity_minutes_today: val },
        })),
      setStepsToday: (val) => set({ stepsToday: val }),

      setFallDetected: (val) => set({ fallDetected: val }),
      
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

      setNetworkStatus: (status) => set({ networkStatus: status }),
      setHubOnline: (online) => set({ hubOnline: online }),
      setBandConnected: (connected) => set({ bandConnected: connected }),

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
          mockNotifications: INITIAL_NOTIFICATIONS,
        }),
    }),
    {
      name: "lumohub-demo-settings",
      partialize: (s) => ({
        isDemoMode: s.isDemoMode,
        batteryLevel: s.batteryLevel,
        activityMinutes: s.activityMinutes,
        stepsToday: s.stepsToday,
        networkStatus: s.networkStatus,
        mockCheckInDays: s.mockCheckInDays,
        mockUser: s.mockUser,
      }),
    }
  )
);

