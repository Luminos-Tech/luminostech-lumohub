import { api } from "@/lib/api";
import type { User, SystemLog, Event } from "@/types";

export const adminApi = {
  users: () => api.get<User[]>("/admin/users"),
  createUser: (data: { full_name: string; email: string; password: string; role: string }) =>
    api.post<User>("/admin/users", data),
  resetPassword: (id: number, new_password: string) =>
    api.patch(`/admin/users/${id}/password`, { new_password }),
  lockUser: (id: number) => api.patch<User>(`/admin/users/${id}/lock`),
  unlockUser: (id: number) => api.patch<User>(`/admin/users/${id}/unlock`),
  setRole: (id: number, role: string) => api.patch<User>(`/admin/users/${id}/role`, { role }),
  logs: () => api.get<SystemLog[]>("/admin/logs"),
  events: () => api.get<Event[]>("/admin/events"),
  notifyDevice: (device_id: string, title: string, body: string) =>
    api.post("/admin/device/notify", { device_id, title, body }),
  sendTextToDevice: (device_id: string, text: string) =>
    api.post("/admin/device/send", { device_id, text }),
};
