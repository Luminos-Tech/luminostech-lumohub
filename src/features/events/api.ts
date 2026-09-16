import { api } from "@/lib/api";
import type { Event } from "@/types";

export const eventsApi = {
  list: (params?: { start?: string; end?: string }) =>
    api.get<Event[]>("/events", { params }),

  get: (id: number) => api.get<Event>(`/events/${id}`),

  create: (data: Partial<Event> & { reminders?: { remind_before_minutes: number; channel: string }[] }) =>
    api.post<Event>("/events", data),

  update: (id: number, data: Partial<Event>) =>
    api.patch<Event>(`/events/${id}`, data),

  delete: (id: number) => api.delete(`/events/${id}`),
};
