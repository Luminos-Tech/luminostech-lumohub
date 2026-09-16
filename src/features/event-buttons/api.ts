import { api } from "@/lib/api";
import type { EventButton, TodayButtonStatus } from "@/types";

export const eventButtonsApi = {
  list: (limit = 100) => api.get<EventButton[]>(`/event-buttons?limit=${limit}`),

  todayStatus: () => api.get<TodayButtonStatus>(`/event-buttons/today`),
};
