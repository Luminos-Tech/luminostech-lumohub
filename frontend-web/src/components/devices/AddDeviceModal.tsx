"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useDeviceStore } from "@/store/deviceStore";
import {
  Smartphone,
  X,
  ChevronRight,
  Camera,
  CameraOff,
  Shield,
  RefreshCw,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";

interface AddDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

/* ─────────────────────────────────────────────
   Helper: 解析 QR 码内容
───────────────────────────────────────────── */
function parseQRContent(text: string): { device_id: string; device_name?: string } | null {
  try {
    const data = JSON.parse(text);
    if (data.device_id) {
      return { device_id: data.device_id, device_name: data.device_name };
    }
  } catch {}
  return null;
}

/* ─────────────────────────────────────────────
   添加设备弹窗
   用户打开摄像头扫描 LUMO 设备上显示的 QR 码
   QR 内容: {"device_id": "0001", "device_name": "Lumo Hub"}
   扫描成功后自动填入 device_id，一键完成绑定
───────────────────────────────────────────── */
export function AddDeviceModal({ open, onClose, onAdded }: AddDeviceModalProps) {
  const { registerDevice } = useDeviceStore();
  const [mounted, setMounted] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [status, setStatus] = useState<"scanning" | "success" | "error">("scanning");
  const [scannedDevice, setScannedDevice] = useState<{ device_id: string; device_name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraList, setCameraList] = useState<{ id: string; label: string }[]>([]);
  const [currentCamera, setCurrentCamera] = useState<string>("environment");
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrcodeRef = useRef<any>(null);
  const hasScannedRef = useRef(false);
  const Html5QrcodeScannerRef = useRef<unknown>(null);

  // 标记组件已在客户端挂载，防止 SSR 时初始化
  useEffect(() => { setMounted(true); }, []);

  // 监听扫描器容器尺寸就绪后再启动
  useEffect(() => {
    if (!open || !scannerRef.current) return;
    const el = scannerRef.current;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      setContainerReady(true);
      return;
    }
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setContainerReady(true);
        ro.disconnect();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // 获取可用摄像头列表
  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
      setCameraList(videoDevices);
      return videoDevices;
    } catch {
      return [];
    }
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrcodeRef.current) {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      }
      if (Html5QrcodeScannerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scanner = Html5QrcodeScannerRef.current as any;
        if (scanner.clear) {
          await scanner.clear();
        }
        Html5QrcodeScannerRef.current = null;
      }
    } catch {}
  }, []);

  const startScannerWithCamera = useCallback(async (cameraId: string) => {
    setStatus("scanning");
    setCameraError("");
    setErrorMsg("");
    hasScannedRef.current = false;

    // 等待 DOM 完全渲染
    await new Promise((r) => setTimeout(r, 100));

    const containerId = "qr-reader-add-device";
    const container = document.getElementById(containerId);
    if (!container) {
      setStatus("error");
      setCameraError("Không tìm thấy vùng quét. Vui lòng thử lại.");
      return;
    }

    // 清空容器
    container.innerHTML = "";

    try {
      // 动态导入 html5-qrcode
      const { Html5Qrcode } = await import("html5-qrcode");

      // 检测 html5-qrcode 版本
      const version = Html5Qrcode["LIB"]?.v || "2.x";

      if (version.startsWith("2.")) {
        // html5-qrcode v2.x: 使用 Html5Qrcode 类
        const scanner = new Html5Qrcode(containerId);
        html5QrcodeRef.current = scanner;

        // 获取摄像头约束
        const constraints = cameraId === "environment" || cameraId === "user"
          ? { facingMode: cameraId }
          : { deviceId: { exact: cameraId } };

        await scanner.start(
          constraints,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            const data = parseQRContent(decodedText);
            if (data) {
              setScannedDevice({ device_id: data.device_id, device_name: data.device_name || "Lumo Hub" });
              setStatus("success");
              await stopScanner();
            } else {
              setErrorMsg("Mã QR không hợp lệ, vui lòng quét mã từ thiết bị LUMO");
              setStatus("error");
              hasScannedRef.current = false;
            }
          },
          () => {}
        );
      } else {
        // html5-qrcode v1.x: 使用 Html5QrcodeScanner 类（已废弃但兼容）
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        const scanner = new Html5QrcodeScanner(
          containerId,
          { fps: 10, qrbox: { width: 220, height: 220 } },
          false
        );
        Html5QrcodeScannerRef.current = scanner;

        scanner.render(
          (decodedText: string) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            const data = parseQRContent(decodedText);
            if (data) {
              setScannedDevice({ device_id: data.device_id, device_name: data.device_name || "Lumo Hub" });
              setStatus("success");
              stopScanner();
            } else {
              setErrorMsg("Mã QR không hợp lệ, vui lòng quét mã từ thiết bị LUMO");
              setStatus("error");
              hasScannedRef.current = false;
            }
          },
          () => {}
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus("error");
      if (errorMessage.toLowerCase().includes("permission") || 
          errorMessage.toLowerCase().includes("denied") ||
          errorMessage.toLowerCase().includes("notallowed")) {
        setCameraError("Không thể truy cập camera. Vui lòng cho phép truy cập camera trong cài đặt trình duyệt.");
      } else if (errorMessage.toLowerCase().includes("notfound") || 
                 errorMessage.toLowerCase().includes("no camera")) {
        setCameraError("Không tìm thấy camera trên thiết bị này.");
      } else if (errorMessage.toLowerCase().includes("overconstrained")) {
        // 后置摄像头不可用，尝试前置
        if (cameraId === "environment") {
          setCurrentCamera("user");
          return;
        }
        setCameraError("Camera không khả dụng trên thiết bị này.");
      } else {
        setCameraError(`Không thể khởi động camera: ${errorMessage.slice(0, 100)}`);
      }
    }
  }, [stopScanner]);

  // 容器就绪后自动启动扫描器
  useEffect(() => {
    if (!open || !mounted || !containerReady) return;
    const t = setTimeout(async () => {
      await getCameras();
      await startScannerWithCamera(currentCamera);
    }, 200);
    return () => { clearTimeout(t); stopScanner(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, containerReady]);

  // 切换摄像头
  const handleSwitchCamera = useCallback(async () => {
    await stopScanner();
    const nextCamera = currentCamera === "environment" ? "user" : "environment";
    setCurrentCamera(nextCamera);
    await startScannerWithCamera(nextCamera);
  }, [currentCamera, stopScanner, startScannerWithCamera]);

  const handleRegister = async () => {
    if (!scannedDevice) return;
    setSubmitting(true);
    try {
      await registerDevice(scannedDevice.device_id);
      toast.success(`Đã thêm thiết bị ${scannedDevice.device_id}`);
      onAdded();
      onClose();
    } catch {
      toast.error("Thêm thất bại, thiết bị có thể đã được sử dụng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = useCallback(() => {
    setScannedDevice(null);
    setErrorMsg("");
    setStatus("scanning");
    setTimeout(async () => {
      await getCameras();
      await startScannerWithCamera(currentCamera);
    }, 300);
  }, [currentCamera, getCameras, startScannerWithCamera]);

  // 手动输入 device_id 作为备选方案
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(false);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = manualInput.trim().toUpperCase();
    if (!id) { toast.error("Nhập ID thiết bị"); return; }
    setScannedDevice({ device_id: id, device_name: "Lumo Hub" });
    setStatus("success");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl overflow-hidden rounded-t-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Thêm thiết bị</h2>
            <p className="text-xs text-gray-400 mt-0.5">Quét mã QR trên thiết bị LUMO</p>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {/* ── 扫描中 ── */}
          {status === "scanning" && (
            <div className="space-y-4">
              {/* 摄像头预览区域 */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                <div id="qr-reader-add-device" ref={scannerRef} className="w-full h-full" />
                {/* 扫描框遮罩 */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[65%] aspect-square border-2 border-white/60 rounded-2xl" />
                </div>
                {/* 扫描线动画 */}
                <div className="absolute inset-x-[17.5%] top-[17.5%] h-[1px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse opacity-70" />
              </div>

              {/* 摄像头控制 */}
              <div className="flex items-center justify-center gap-3">
                {cameraList.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                  >
                    <SwitchCamera size={15} />
                    Đổi camera
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                >
                  <RefreshCw size={15} />
                  Làm mới
                </button>
              </div>

              {/* 摄像头错误 */}
              {cameraError && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <CameraOff size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-red-600 font-medium">{cameraError}</p>
                    </div>
                  </div>

                  {/* 手动输入备选 */}
                  {!showManual && (
                    <button
                      onClick={() => setShowManual(true)}
                      className="w-full py-2.5 border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 rounded-xl text-sm font-medium transition-colors"
                    >
                      Nhập ID thiết bị thủ công
                    </button>
                  )}

                  {showManual && (
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                      <input
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="VD: 0001"
                        maxLength={20}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        OK
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* 提示文字 */}
              {!cameraError && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Đưa mã QR trên thiết bị LUMO vào khung</p>
                  <p className="text-xs text-gray-400 mt-1">Mã QR chứa: {"{device_id, device_name}"}</p>
                </div>
              )}
            </div>
          )}

          {/* ── 扫描成功 ── */}
          {status === "success" && scannedDevice && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <Shield size={32} className="text-green-600" />
                </div>
                <p className="text-sm font-semibold text-green-600">Quét thành công!</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Smartphone size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Thiết bị</p>
                    <p className="font-bold font-mono text-gray-900 text-base tracking-widest">
                      {scannedDevice.device_id}
                    </p>
                    <p className="text-sm text-gray-500">{scannedDevice.device_name}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={15} />
                  Quét tiếp
                </button>
                <button
                  onClick={handleRegister}
                  disabled={submitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? "Đang thêm..." : "Thêm thiết bị"}
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── 扫描失败 ── */}
          {status === "error" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-3">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-3">
                  <CameraOff size={32} className="text-red-400" />
                </div>
                <p className="text-sm font-semibold text-red-600">Quét thất bại</p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600 text-center">{errorMsg}</p>
                </div>
              )}

              {/* 手动输入备选 */}
              {!showManual && (
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-medium transition-colors"
                >
                  Nhập ID thiết bị thủ công
                </button>
              )}

              {showManual && (
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="VD: 0001"
                    maxLength={20}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    OK
                  </button>
                </form>
              )}

              <button
                onClick={handleRetry}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
