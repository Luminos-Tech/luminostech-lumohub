import { api } from "@/lib/api";
import type { Device } from "@/types";

export const devicesApi = {
  list: () => api.get<Device[]>("/devices"),

  get: (id: number) => api.get<Device>(`/devices/${id}`),

  register: (device_id: string) => api.post<Device>("/devices", { device_id }),

  update: (id: number, data: Partial<Device>) =>
    api.patch<Device>(`/devices/${id}`, data),

  delete: (id: number) => api.delete(`/devices/${id}`),
};
