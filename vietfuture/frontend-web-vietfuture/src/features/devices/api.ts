import { api } from "@/lib/api";
import type { Device, DeviceCommandResult, DeviceControlStatus, DeviceLogTarget, DeviceLogsResponse, DeviceSound } from "@/types";

export const devicesApi = {
  list: () => api.get<Device[]>("/devices"),

  get: (id: number) => api.get<Device>(`/devices/${id}`),

  register: (device_id: string) => api.post<Device>("/devices", { device_id }),

  update: (id: number, data: Partial<Device>) =>
    api.patch<Device>(`/devices/${id}`, data),

  delete: (id: number) => api.delete(`/devices/${id}`),

  controlStatus: (id: number) => api.get<DeviceControlStatus>(`/devices/${id}/control`),

  logs: (id: number, after = 0) =>
    api.get<DeviceLogsResponse>(`/devices/${id}/logs`, { params: { after, limit: 100 }, timeout: 10000 }),

  logTargets: () => api.get<DeviceLogTarget[]>("/devices/log-targets"),

  playSound: (id: number, sound: DeviceSound) =>
    api.post<DeviceCommandResult>(`/devices/${id}/commands`, { action: "play_sound", sound }, { timeout: 25000 }),

  stopAudio: (id: number) =>
    api.post<DeviceCommandResult>(`/devices/${id}/commands`, { action: "stop_audio" }, { timeout: 25000 }),
};
