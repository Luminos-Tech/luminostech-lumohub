"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Terminal } from "lucide-react";
import { isAxiosError } from "axios";
import { devicesApi } from "@/features/devices/api";
import { useAuthStore } from "@/store/authStore";
import { DeviceLogPanel } from "@/components/devices/DeviceLogPanel";
import type { DeviceLogTarget } from "@/types";

export function DeviceLogsViewer({ isEnglish }: { isEnglish: boolean }) {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const [targets, setTargets] = useState<DeviceLogTarget[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!authenticated) {
      setTargets([]);
      setSelected(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    setDisabled(false);
    void devicesApi.logTargets().then(({ data }) => {
      if (!active) return;
      setTargets(data);
      setSelected((current) => data.some((target) => target.id === current) ? current : data[0]?.id ?? null);
    }).catch((failure) => {
      if (!active) return;
      setTargets([]);
      setSelected(null);
      setDisabled(isAxiosError(failure) && failure.response?.status === 403);
      setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [authenticated, revision]);

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      aria-label={isEnglish ? "Device logs" : "Log thiết bị"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <Terminal size={18} />{isEnglish ? "Device logs" : "Log thiết bị"}
        </h2>
        {authenticated && <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading}
          aria-label={isEnglish ? "Refresh log devices" : "Làm mới danh sách thiết bị xem log"}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>}
      </div>
      <p className="text-sm text-slate-500">{isEnglish
        ? "Every signed-in account can view device logs."
        : "Mọi tài khoản đã đăng nhập đều có thể xem log thiết bị."}</p>
      {!authenticated ? <p className="text-sm text-slate-500">{isEnglish ? "Sign in to view logs." : "Đăng nhập để xem log."}</p>
        : loading && targets.length === 0 ? <p className="text-sm text-slate-500">{isEnglish ? "Loading devices..." : "Đang tải thiết bị..."}</p>
        : error ? <p role="status" className="text-sm text-amber-700 dark:text-amber-400">{disabled
          ? (isEnglish ? "Log viewing is temporarily disabled." : "Chức năng xem log đang tắt tạm thời.")
          : (isEnglish ? "Could not load devices. Please refresh." : "Chưa tải được danh sách thiết bị. Bấm làm mới để thử lại.")}</p>
        : targets.length === 0 ? <p className="text-sm text-slate-500">{isEnglish ? "No registered Hubs yet." : "Chưa có Hub được đăng ký."}</p>
        : <>
          <label className="block space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <span>{isEnglish ? "Device to observe" : "Thiết bị xem log"}</span>
            <select value={selected ?? ""} onChange={(event) => setSelected(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              {targets.map((target) => <option key={target.id} value={target.id}>Hub {target.device_id}</option>)}
            </select>
          </label>
          {selected !== null && <DeviceLogPanel key={selected} deviceId={selected} isEnglish={isEnglish} />}
        </>}
    </section>
  );
}
