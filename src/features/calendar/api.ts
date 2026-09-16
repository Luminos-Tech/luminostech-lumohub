import { api } from "@/lib/api";
import type { Event } from "@/types";

export const calendarApi = {
  view: (params: { view?: string; start?: string; end?: string }) =>
    api.get<Event[]>("/calendar", { params }),
};
