import { create } from "zustand";
import type { Event } from "@/types";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface EventState {
  events: Event[];
  loading: boolean;
  /** Timestamp of the last successful fetch — used for cache invalidation */
  lastFetchedAt: number | null;
  fetchEvents: (start?: Date, end?: Date) => Promise<void>;
  /** Force a fresh fetch regardless of cache */
  refetchEvents: (start?: Date, end?: Date) => Promise<void>;
  createEvent: (data: Partial<Event> & { reminders?: { remind_before_minutes: number; channel: string }[] }) => Promise<Event>;
  updateEvent: (id: number, data: Partial<Event>) => Promise<Event>;
  deleteEvent: (id: number) => Promise<void>;
}

/** Don't refetch if last fetch was less than 30 seconds ago */
const CACHE_TTL_MS = 30_000;

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  lastFetchedAt: null,

  fetchEvents: async (start?, end?) => {
    const { lastFetchedAt, loading, events } = get();
    // Skip fetch if we already have data and it's still fresh
    if (loading) return;
    if (events.length > 0 && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
      return;
    }
    set({ loading: true });
    try {
      const params: Record<string, string> = {};
      if (start) params.start = start.toISOString();
      if (end) params.end = end.toISOString();
      const res = await api.get<Event[]>("/events", { params });
      set({ events: res.data, lastFetchedAt: Date.now() });
    } finally {
      set({ loading: false });
    }
  },

  refetchEvents: async (start?, end?) => {
    set({ loading: true, lastFetchedAt: null });
    try {
      const params: Record<string, string> = {};
      if (start) params.start = start.toISOString();
      if (end) params.end = end.toISOString();
      const res = await api.get<Event[]>("/events", { params });
      set({ events: res.data, lastFetchedAt: Date.now() });
    } finally {
      set({ loading: false });
    }
  },

  createEvent: async (data) => {
    const res = await api.post<Event>("/events", data);
    set((s) => ({ events: [...s.events, res.data], lastFetchedAt: Date.now() }));
    return res.data;
  },

  updateEvent: async (id, data) => {
    const res = await api.patch<Event>(`/events/${id}`, data);
    set((s) => ({ events: s.events.map((e) => (e.id === id ? res.data : e)), lastFetchedAt: Date.now() }));
    return res.data;
  },

  deleteEvent: async (id) => {
    await api.delete(`/events/${id}`);
    set((s) => ({ events: s.events.filter((e) => e.id !== id), lastFetchedAt: Date.now() }));
  },
}));
