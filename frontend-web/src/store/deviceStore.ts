import { create } from "zustand";
import type { Device } from "@/types";
import { devicesApi } from "@/features/devices/api";

interface DeviceState {
  devices: Device[];
  loading: boolean;
  fetchDevices: () => Promise<void>;
  registerDevice: (device_id: string) => Promise<Device>;
  updateDevice: (id: number, data: Partial<Device>) => Promise<Device>;
  deleteDevice: (id: number) => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  loading: false,

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const res = await devicesApi.list();
      set({ devices: res.data });
    } finally {
      set({ loading: false });
    }
  },

  registerDevice: async (device_id) => {
    const res = await devicesApi.register(device_id);
    set((s) => ({ devices: [res.data, ...s.devices] }));
    return res.data;
  },

  updateDevice: async (id, data) => {
    const res = await devicesApi.update(id, data);
    set((s) => ({ devices: s.devices.map((d) => (d.id === id ? res.data : d)) }));
    return res.data;
  },

  deleteDevice: async (id) => {
    await devicesApi.delete(id);
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
  },
}));
