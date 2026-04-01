import { create } from "zustand";
import type { Event } from "@/types";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface EventState {
  events: Event[];
  loading: boolean;
  fetchEvents: (start?: Date, end?: Date) => Promise<void>;
  createEvent: (data: Partial<Event> & { reminders?: { remind_before_minutes: number; channel: string }[] }) => Promise<Event>;
  updateEvent: (id: number, data: Partial<Event>) => Promise<Event>;
  deleteEvent: (id: number) => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,

  fetchEvents: async (start?, end?) => {
    set({ loading: true });
    try {
      const params: Record<string, string> = {};
      if (start) params.start = start.toISOString();
      if (end) params.end = end.toISOString();
      const res = await api.get<Event[]>("/events", { params });
      set({ events: res.data });
    } finally {
      set({ loading: false });
    }
  },

  createEvent: async (data) => {
    const res = await api.post<Event>("/events", data);
    set((s) => ({ events: [...s.events, res.data] }));
    return res.data;
  },

  updateEvent: async (id, data) => {
    const res = await api.patch<Event>(`/events/${id}`, data);
    set((s) => ({ events: s.events.map((e) => (e.id === id ? res.data : e)) }));
    return res.data;
  },

  deleteEvent: async (id) => {
    await api.delete(`/events/${id}`);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },
}));
