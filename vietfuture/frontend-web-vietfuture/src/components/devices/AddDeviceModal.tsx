"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { isAxiosError } from "axios";
import { Camera, ChevronRight, Hash, Loader2, RefreshCw, ShieldCheck, SwitchCamera, X } from "lucide-react";
import { toast } from "sonner";
import { useDeviceStore } from "@/store/deviceStore";
import { usePreferenceStore } from "@/store/preferenceStore";

interface AddDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function normalizeDeviceCode(value: string): string | null {
  const code = value.trim();
  return /^[0-9]{1,4}$/.test(code) ? code.padStart(4, "0") : null;
}

function parseQRContent(text: string): { device_id: string; device_name: string } | null {
  try {
    const data = JSON.parse(text);
    if (!data || !["string", "number"].includes(typeof data.device_id)) return null;
    const code = normalizeDeviceCode(String(data.device_id));
    if (!code) return null;
    return { device_id: code, device_name: typeof data.device_name === "string" ? data.device_name : "Lumo Hub" };
  } catch {
    return null;
  }
}

// Mount a fresh dialog on each opening: no stale code or camera session.
export function AddDeviceModal(props: AddDeviceModalProps) {
  return props.open ? <AddDeviceDialog {...props} /> : null;
}

function AddDeviceDialog({ onClose, onAdded }: AddDeviceModalProps) {
  const { registerDevice } = useDeviceStore();
  const en = usePreferenceStore((state) => state.language === "en");
  const [mode, setMode] = useState<"manual" | "qr">("manual");
  const [manualInput, setManualInput] = useState("");
  const [candidate, setCandidate] = useState<{ device_id: string; device_name: string } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [camera, setCamera] = useState<"environment" | "user">("environment");
  const [scanAttempt, setScanAttempt] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraSession = useRef<Promise<void>>(Promise.resolve());
  const normalizedCode = normalizeDeviceCode(manualInput);
  const invalidCode = en ? "Enter a device code containing 1 to 4 digits." : "Mã thiết bị phải gồm từ 1 đến 4 chữ số.";

  useEffect(() => {
    if (mode !== "qr" || candidate) return;
    let cancelled = false;
    let found = false;
    let scanner: Html5Qrcode | null = null;
    const previousSession = cameraSession.current;
    let releaseSession: () => void = () => undefined;
    cameraSession.current = new Promise<void>((resolve) => { releaseSession = resolve; });
    setCameraReady(false);

    const start = async () => {
      try {
        await previousSession;
        if (cancelled) return;
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode("qr-reader-add-device");
        await scanner.start(
          { facingMode: camera },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (cancelled || found) return;
            const device = parseQRContent(text);
            if (device) {
              found = true;
              setError("");
              setCandidate(device);
            } else {
              setError(en ? "This QR code does not contain a numeric LUMO device code." : "Mã QR không chứa mã số thiết bị LUMO hợp lệ.");
            }
          },
          () => undefined,
        );
        if (!cancelled) setCameraReady(true);
      } catch {
        if (!cancelled) {
          setError(en
            ? "Could not open the camera. Use Enter code or check camera permission."
            : "Không mở được camera. Bạn có thể nhập mã số hoặc kiểm tra quyền camera.");
        }
      }
    };
    const startup = start();

    return () => {
      cancelled = true;
      // Wait for pending permission/startup before stopping, and finish this
      // session before a retry or camera switch creates another scanner.
      void startup.then(async () => {
        try {
          if (scanner?.isScanning) await scanner.stop();
          scanner?.clear();
        } catch {}
        releaseSession();
      });
    };
  }, [mode, candidate, camera, scanAttempt, en]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose, submitting]);

  const selectMode = (next: "manual" | "qr") => {
    setMode(next);
    setError("");
    setCandidate(null);
  };

  const confirmCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedCode) {
      setError(invalidCode);
      return;
    }
    setError("");
    setCandidate({ device_id: normalizedCode, device_name: "Lumo Hub" });
  };

  const register = async () => {
    if (!candidate || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await registerDevice(candidate.device_id);
      toast.success(en ? `Device ${candidate.device_id} added` : `Đã thêm thiết bị ${candidate.device_id}`);
      onAdded();
      onClose();
    } catch (failure) {
      const conflict = isAxiosError(failure) && failure.response?.status === 409;
      setError(conflict
        ? (en ? "This device is already registered to another account." : "Thiết bị này đã được đăng ký với tài khoản khác.")
        : (en ? "Could not add this device. Please try again." : "Không thêm được thiết bị. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="add-device-title"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-md sm:rounded-2xl dark:bg-slate-900">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id="add-device-title" className="text-lg font-bold text-slate-900 dark:text-white">{en ? "Add device" : "Thêm thiết bị"}</h2>
            <p className="mt-1 text-xs text-slate-500">{en ? "Enter the device code or scan its QR code." : "Nhập mã số hoặc quét QR của thiết bị."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label={en ? "Close" : "Đóng"}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          {!candidate ? (
            <>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={en ? "Add method" : "Cách thêm thiết bị"}>
                {(["manual", "qr"] as const).map((method) => (
                  <button type="button" key={method} aria-pressed={mode === method} onClick={() => selectMode(method)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${mode === method
                      ? "border-teal-700 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                      : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>
                    {method === "manual" ? <Hash size={17} /> : <Camera size={17} />}
                    {method === "manual" ? (en ? "Enter code" : "Nhập mã số") : (en ? "Scan QR" : "Quét QR")}
                  </button>
                ))}
              </div>

              {mode === "manual" ? (
                <form onSubmit={confirmCode} noValidate className="space-y-3">
                  <label htmlFor="device-numeric-code" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {en ? "Device code" : "Mã thiết bị"}
                  </label>
                  <input id="device-numeric-code" type="text" inputMode="numeric" autoComplete="off"
                    value={manualInput} onChange={(event) => { setManualInput(event.target.value); setError(""); }}
                    placeholder="0001" maxLength={4} autoFocus aria-invalid={Boolean(error)}
                    aria-describedby="device-code-hint"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  <p id="device-code-hint" className="text-xs leading-relaxed text-slate-500">
                    {en ? "Enter 1–4 digits. Short codes are padded with zeros, for example 1 → 0001."
                      : "Nhập 1–4 chữ số. Mã ngắn sẽ được thêm số 0 phía trước, ví dụ 1 → 0001."}
                  </p>
                  {normalizedCode && <p className="text-sm text-teal-700 dark:text-teal-300">
                    {en ? "Device to add: " : "Mã sẽ thêm: "}<strong className="font-mono">{normalizedCode}</strong>
                  </p>}
                  <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800">
                    {en ? "Continue" : "Tiếp tục"}<ChevronRight size={17} />
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-black">
                    <div id="qr-reader-add-device" className="h-full w-full" />
                  </div>
                  <p className="text-center text-xs text-slate-500">{cameraReady
                    ? (en ? "Place the device QR code inside the camera frame." : "Đưa mã QR thiết bị vào khung camera.")
                    : (en ? "Opening camera..." : "Đang mở camera...")}</p>
                  <div className="flex justify-center gap-3">
                    <button type="button" onClick={() => { setError(""); setCamera(camera === "environment" ? "user" : "environment"); }}
                      className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-white">
                      <SwitchCamera size={16} />{en ? "Switch camera" : "Đổi camera"}
                    </button>
                    <button type="button" onClick={() => { setError(""); setScanAttempt((attempt) => attempt + 1); }}
                      className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-white">
                      <RefreshCw size={16} />{en ? "Retry" : "Thử lại"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-teal-50 p-5 dark:bg-teal-950">
                <ShieldCheck size={34} className="text-teal-700 dark:text-teal-300" />
                <h3 className="font-semibold text-slate-900 dark:text-white">{en ? "Confirm device code" : "Xác nhận mã thiết bị"}</h3>
                <strong className="font-mono text-3xl tracking-[0.3em] text-teal-800 dark:text-teal-200">{candidate.device_id}</strong>
                <span className="text-sm text-slate-500">{candidate.device_name}</span>
              </div>
              <div className="flex gap-3">
                <button type="button" disabled={submitting} onClick={() => { setCandidate(null); setError(""); }}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200">
                  {mode === "manual" ? (en ? "Edit code" : "Sửa mã") : (en ? "Scan again" : "Quét lại")}
                </button>
                <button type="button" disabled={submitting} onClick={() => void register()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? (en ? "Adding..." : "Đang thêm...") : (en ? "Add device" : "Thêm thiết bị")}
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</p>}
        </div>
      </section>
    </div>
  );
}
