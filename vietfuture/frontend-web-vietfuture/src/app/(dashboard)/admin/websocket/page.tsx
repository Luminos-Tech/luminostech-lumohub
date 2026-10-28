"use client";

import { useEffect } from "react";
import { DeviceAudioControl } from "@/components/devices/DeviceAudioControl";
import { DeviceLogsViewer } from "@/components/devices/DeviceLogsViewer";
import { useDeviceStore } from "@/store/deviceStore";
import { usePreferenceStore } from "@/store/preferenceStore";

export default function AdminWsPage() {
  const { devices, loading, fetchDevices } = useDeviceStore();
  const isEnglish = usePreferenceStore((state) => state.language === "en");

  useEffect(() => { void fetchDevices().catch(() => undefined); }, [fetchDevices]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{isEnglish ? "Control LUMO Hub" : "Điều khiển LUMO Hub"}</h1>
        <p className="mt-2 text-sm text-slate-500">{isEnglish
          ? "Play and stop audio on your connected hardware. Results are confirmed by the Hub."
          : "Phát và dừng âm thanh trên thiết bị thật. Hub sẽ gửi xác nhận sau khi thực hiện."}</p>
      </header>
      <DeviceLogsViewer isEnglish={isEnglish} />
      {loading && devices.length === 0 && <p>{isEnglish ? "Loading devices..." : "Đang tải thiết bị..."}</p>}
      {!loading && devices.length === 0 && <p>{isEnglish ? "Add a Hub in Settings → Devices first." : "Thêm Hub trong Cài đặt → Thiết bị trước."}</p>}
      {devices.map((device) => <DeviceAudioControl key={device.id} device={device} isEnglish={isEnglish} />)}
    </main>
  );
}
