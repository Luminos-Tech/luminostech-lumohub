import { api } from "@/lib/api";
import type { User, SystemLog, Event } from "@/types";

export const adminApi = {
  users: () => api.get<User[]>("/admin/users"),
  lockUser: (id: number) => api.patch<User>(`/admin/users/${id}/lock`),
  unlockUser: (id: number) => api.patch<User>(`/admin/users/${id}/unlock`),
  setRole: (id: number, role: string) => api.patch<User>(`/admin/users/${id}/role`, { role }),
  logs: () => api.get<SystemLog[]>("/admin/logs"),
  events: () => api.get<Event[]>("/admin/events"),
};
