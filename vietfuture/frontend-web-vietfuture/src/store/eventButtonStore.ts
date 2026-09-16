import { create } from "zustand";
import type { EventButton, TodayButtonStatus } from "@/types";
import { eventButtonsApi } from "@/features/event-buttons/api";

interface EventButtonState {
  events: EventButton[];
  todayStatus: TodayButtonStatus | null;
  loading: boolean;
  todayLoading: boolean;
  fetchEvents: () => Promise<void>;
  fetchTodayStatus: () => Promise<void>;
}

export const useEventButtonStore = create<EventButtonState>((set) => ({
  events: [],
  todayStatus: null,
  loading: false,
  todayLoading: false,

  fetchEvents: async () => {
    set({ loading: true });
    try {
      const res = await eventButtonsApi.list();
      set({ events: res.data });
    } finally {
      set({ loading: false });
    }
  },

  fetchTodayStatus: async () => {
    set({ todayLoading: true });
    try {
      const res = await eventButtonsApi.todayStatus();
      set({ todayStatus: res.data });
    } finally {
      set({ todayLoading: false });
    }
  },
}));
