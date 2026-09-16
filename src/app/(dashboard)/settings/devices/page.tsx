"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Info, Activity, BatteryMedium, Bell, Clock3, Plus, Power, QrCode, Trash2, Wifi, WifiOff, X, Zap } from "lucide-react";
import { format, formatDistanceToNow, parseISO, addYears } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { toast } from "sonner";
import { AddDeviceModal } from "@/components/devices/AddDeviceModal";
import Modal from "@/components/common/Modal";
import { adminApi } from "@/features/admin/api";
import { useDeviceStore } from "@/store/deviceStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { useDemoStore, formatDisplayPersonName } from "@/demo/store";
import type { Device } from "@/types";

const BAND_TYPICAL_BATTERY_DAYS = 730;

function getDeviceUptime(createdAt: string, isEnglish: boolean) {
  try {
    return formatDistanceToNow(parseISO(createdAt), {
      addSuffix: true,
      locale: isEnglish ? enUS : vi,
    });
  } catch {
    return isEnglish ? "unknown" : "không rõ";
  }
}

function getBatteryData(level?: number) {
  if (typeof level !== "number" || Number.isNaN(level)) {
    return { level: null, days: null };
  }
  const normalizedLevel = Math.min(100, Math.max(0, Math.round(level)));
  return {
    level: normalizedLevel,
    days: Math.round((normalizedLevel / 100) * BAND_TYPICAL_BATTERY_DAYS),
  };
}

function DeviceQRModal({
  device,
  onClose,
  isEnglish,
}: {
  device: Device;
  onClose: () => void;
  isEnglish: boolean;
}) {
  return (
    <div className="device-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="pairing-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="device-modal-heading">
          <div>
            <p className="lumo-kicker">LUMO HUB</p>
            <h2 id="pairing-title">{isEnglish ? "Pairing QR code" : "Mã QR ghép đôi"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={isEnglish ? "Close" : "Đóng"}><X size={19} /></button>
        </header>
        <div className="device-qr-content">
          <Image src="/api/v1/devices/qr" alt={isEnglish ? "Lumo Hub pairing QR code" : "Mã QR ghép đôi Lumo Hub"} width={208} height={208} unoptimized />
          <strong>{device.device_id}</strong>
          <p>{isEnglish ? "Scan this code with your Lumo Hub to pair again." : "Dùng Lumo Hub quét mã này để ghép đôi lại."}</p>
        </div>
      </section>
    </div>
  );
}

function NotifyModal({
  device,
  onClose,
  isEnglish,
}: {
  device: Device;
  onClose: () => void;
  isEnglish: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error(isEnglish ? "Enter a title and message" : "Nhập đủ tiêu đề và nội dung");
      return;
    }

    setSending(true);
    try {
      await adminApi.notifyDevice(device.device_id, title.trim(), body.trim());
      toast.success(isEnglish ? "Notification sent" : "Đã gửi thông báo");
      onClose();
    } catch {
      toast.error(isEnglish ? "Could not send notification" : "Gửi thông báo thất bại");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="device-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="notify-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="device-modal-heading">
          <div>
            <p className="lumo-kicker">LUMO HUB</p>
            <h2 id="notify-title">{isEnglish ? "Send notification" : "Gửi thông báo"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={isEnglish ? "Close" : "Đóng"}><X size={19} /></button>
        </header>
        <form className="device-notify-form" onSubmit={handleSend}>
          <label>
            <span>{isEnglish ? "Title" : "Tiêu đề"}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isEnglish ? "Medication reminder" : "Nhắc uống thuốc"} autoFocus />
          </label>
          <label>
            <span>{isEnglish ? "Message" : "Nội dung"}</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder={isEnglish ? "It is time to take your medicine." : "Đến giờ uống thuốc rồi ạ."} />
          </label>
          <button type="submit" disabled={sending}><Zap size={17} />{sending ? (isEnglish ? "Sending..." : "Đang gửi...") : (isEnglish ? "Send to Hub" : "Gửi đến Hub")}</button>
        </form>
      </section>
    </div>
  );
}

function DeviceInfoModal({
  device,
  profile,
  type,
  onClose,
  isEnglish,
}: {
  device?: Device;
  profile?: { id: string; name: string; type: string; icon?: string; device_id?: string; batteryLevel?: number; hubOnline?: boolean };
  type: "hub" | "band";
  onClose: () => void;
  isEnglish: boolean;
}) {
  const deviceId = profile?.device_id || device?.device_id || (type === "hub" ? "LB-100" : "LH-8821");
  const isOnline = profile ? (type === "hub" ? (profile.hubOnline ?? true) : true) : (device?.is_active ?? true);
  
  const purchaseDateStr = device?.created_at || (deviceId === "LH-8822" ? "2025-06-10T08:00:00Z" : deviceId === "LB-101" ? "2025-07-01T10:00:00Z" : "2025-05-15T08:00:00Z");
  const purchaseDate = parseISO(purchaseDateStr);
  const warrantyEnd = addYears(purchaseDate, 2);
  const remainingDays = Math.max(0, Math.ceil((warrantyEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  
  const macSuffix = String(deviceId).replace(/[^0-9A-Z]/gi, "").padEnd(4, "0").slice(0, 4);
  const mac = `00:1A:2B:4C:${macSuffix.substring(0, 2)}:${macSuffix.substring(2, 4)}`;
  const firmware = type === "hub" ? "v2.1.0-lumo" : "v1.2.4-ble";
  const batteryLevel = profile?.batteryLevel ?? device?.battery_level ?? 88;

  const title = type === "hub" ? "LUMO Hub" : "LUMO Band";
  const cleanName = formatDisplayPersonName(profile?.name || "");
  const subtitle = profile 
    ? (type === "band" ? `${isEnglish ? "Assigned to:" : "Gán cho:"} ${profile.icon || "👵"} ${cleanName}` : `${isEnglish ? "Location:" : "Vị trí:"} ${profile.icon || "🛋️"} ${cleanName}`) 
    : `ID ${deviceId}`;

  return (
    <Modal open={true} onClose={onClose} size="sm">
      <div className="flex flex-col gap-3.5 -m-2">
        {/* Compact Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 shrink-0 bg-slate-100 dark:bg-[#0c2627] rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200 dark:border-[#134244] shadow-xs">
            <Image
              src={type === "hub" ? "/products/lumo-hub-studio.webp" : "/products/lumo-band-indigo-diamond.webp"}
              alt={title}
              width={90}
              height={90}
              className={`object-contain ${type === "hub" ? "w-full h-full scale-105" : "w-4/5 h-4/5"}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              {isOnline ? (isEnglish ? "Connected 24/7" : "Đang kết nối 24/7") : (isEnglish ? "Offline" : "Mất kết nối")}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              {title}
            </h3>
            <p className="text-xs text-teal-600 dark:text-[#00f0d2] font-semibold mt-1 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Compact Info List */}
        <div className="bg-slate-50 dark:bg-[#0c2627] border border-slate-200 dark:border-[#134244] rounded-2xl p-3.5 space-y-2 text-xs">
          {/* ID */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#134244]/60">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isEnglish ? "Device ID:" : "Số ID thiết bị:"}
            </span>
            <span className="font-mono font-bold text-teal-700 dark:text-[#00f0d2] bg-teal-50 dark:bg-[#113a3c] px-2 py-0.5 rounded-lg border border-teal-200 dark:border-[#184f52]">
              {deviceId}
            </span>
          </div>

          {/* Firmware */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#134244]/60">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isEnglish ? "Firmware:" : "Số Firmware:"}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{firmware}</span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800/60">
                {isEnglish ? "Latest ✓" : "Mới nhất ✓"}
              </span>
            </div>
          </div>

          {/* Purchase Date */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#134244]/60">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isEnglish ? "Purchase Date:" : "Ngày mua / Kích hoạt:"}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {format(purchaseDate, "dd/MM/yyyy")}
            </span>
          </div>

          {/* Warranty End */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#134244]/60">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isEnglish ? "Warranty Until:" : "Hạn bảo hành:"}
            </span>
            <div className="text-right">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {format(warrantyEnd, "dd/MM/yyyy")}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                {isEnglish ? `(~${remainingDays}d)` : `(Còn ~${remainingDays} ngày)`}
              </span>
            </div>
          </div>

          {/* MAC Address */}
          <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#134244]/60">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isEnglish ? "MAC Address:" : "Địa chỉ MAC:"}
            </span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {mac}
            </span>
          </div>

          {/* Battery level for Band */}
          {type === "band" && (
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {isEnglish ? "Battery Level:" : "Mức pin hiện tại:"}
              </span>
              <span className="font-bold text-teal-700 dark:text-[#00f0d2]">
                {batteryLevel}% (~{Math.round((batteryLevel / 100) * 730)} {isEnglish ? "days" : "ngày"})
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DevicePair({
  device,
  isEnglish,
  deleting,
  onDelete,
  onNotify,
  onShowQR,
  onShowInfo,
}: {
  device: Device;
  isEnglish: boolean;
  deleting: boolean;
  onDelete: () => void;
  onNotify: () => void;
  onShowQR: () => void;
  onShowInfo: (type: "hub" | "band") => void;
}) {
  const battery = getBatteryData(device.battery_level);
  const isOnline = device.is_active;
  const connectedText = isOnline
    ? (isEnglish ? "Connected" : "Đã kết nối")
    : (isEnglish ? "Disconnected" : "Mất kết nối");

  return (
    <section className="device-pair" aria-label={isEnglish ? `Device set ${device.device_id}` : `Bộ thiết bị ${device.device_id}`}>
      <article className="device-product-card hub cursor-pointer hover:border-teal-500/50 transition-colors" onClick={() => onShowInfo("hub")}>
        <div className="device-product-main">
          <div className="device-product-media hub">
            <Image src="/products/lumo-hub-studio.webp" alt="Lumo Hub" width={800} height={800} priority sizes="132px" />
          </div>
          <div className="device-product-copy">
            <div className={`device-connection ${isOnline ? "online" : "offline"}`}><i />{connectedText}</div>
            <p className="lumo-kicker">LUMO HUB</p>
            <h2>Lumo Hub</h2>
            <span className="device-code">ID {device.device_id}</span>
            <div className="device-detail-line">
              {isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
              <span>{isEnglish ? "Home connection" : "Kết nối tại nhà"}</span>
            </div>
            <div className="device-detail-line">
              <Power size={17} />
              <span>{isEnglish ? "Power connected" : "Đang được cấp nguồn"}</span>
            </div>
            <small>{isEnglish ? "Added" : "Đã thêm"} {getDeviceUptime(device.created_at, isEnglish)}</small>
          </div>
        </div>
        <div className="device-card-actions">
          <button type="button" onClick={onNotify}><span><Bell size={19} /></span>{isEnglish ? "Notify" : "Thông báo"}</button>
          <button type="button" onClick={onShowQR}><span><QrCode size={19} /></span>{isEnglish ? "Pairing QR" : "Mã QR"}</button>
          <button type="button" className="danger" onClick={onDelete} disabled={deleting}><span><Trash2 size={19} /></span>{isEnglish ? "Remove" : "Xóa"}</button>
        </div>
      </article>

      <article className="device-product-card band cursor-pointer hover:border-teal-500/50 transition-colors" onClick={() => onShowInfo("band")}>
        <div className="device-product-main">
          <div className="device-product-media band">
            <Image src="/products/lumo-band-indigo-diamond.webp" alt="Lumo Band Indigo Diamond" width={700} height={700} sizes="132px" />
          </div>
          <div className="device-product-copy">
            <div className={`device-connection ${isOnline ? "online" : "offline"}`}><i />{connectedText}</div>
            <p className="lumo-kicker">LUMO BAND</p>
            <h2>Lumo Band</h2>
            <span className="device-code">Indigo Diamond</span>
            <div className="band-battery-value"><BatteryMedium size={20} /><strong>{battery.level === null ? "--" : battery.level}%</strong></div>
            <div className="band-battery-track" aria-label={isEnglish ? "Band battery level" : "Mức pin của Band"}>
              <i style={{ width: `${battery.level ?? 0}%` }} />
            </div>
          </div>
        </div>
        <div className="band-insight-grid">
          <div><span><Clock3 size={19} /></span><strong>{battery.days === null ? "--" : `~${battery.days}`}</strong><small>{isEnglish ? "estimated days left" : "ngày sử dụng ước tính"}</small></div>
          <div><span><Activity size={19} /></span><strong>{device.activity_minutes_today ?? "--"}</strong><small>{isEnglish ? "active minutes today" : "phút vận động hôm nay"}</small></div>
        </div>
        <p className="band-estimate-note">
          {battery.level === null
            ? (isEnglish ? "Waiting for battery data from the Band." : "Đang chờ dữ liệu pin từ Band.")
            : (isEnglish ? "Estimate based on a typical two-year battery life." : "Ước tính theo vòng đời pin điển hình 2 năm.")}
        </p>
      </article>
    </section>
  );
}

function EmptyDevices({ onAdd, isEnglish }: { onAdd: () => void; isEnglish: boolean }) {
  return (
    <section className="device-empty-product" aria-label={isEnglish ? "No connected devices" : "Chưa có thiết bị kết nối"}>
      <div className="device-empty-media">
        <Image src="/products/lumo-family-set.webp" alt={isEnglish ? "Lumo Hub and Lumo Band" : "Lumo Hub và Lumo Band"} width={900} height={635} priority sizes="220px" />
      </div>
      <button type="button" onClick={onAdd}><Plus size={19} />{isEnglish ? "Add device" : "Thêm thiết bị"}</button>
    </section>
  );
}

export default function DevicesPage() {
  const { devices, loading, fetchDevices, deleteDevice } = useDeviceStore();
  const { isDemoMode, mockDevice, batteryLevel, hubOnline, activityMinutes, mockProfiles } = useDemoStore();
  const [showAdd, setShowAdd] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<Device | null>(null);
  const [qrTarget, setQrTarget] = useState<Device | null>(null);
  const [infoTarget, setInfoTarget] = useState<{ device?: Device; profile?: typeof mockProfiles[0]; type: "hub" | "band" } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const isEnglish = usePreferenceStore((state) => state.language === "en");

  useEffect(() => {
    void fetchDevices().catch(() => undefined);
  }, [fetchDevices]);

  const effectiveDevices: Device[] = devices.length > 0 ? devices : (isDemoMode ? [{
    ...mockDevice,
    battery_level: batteryLevel,
    is_active: hubOnline,
    activity_minutes_today: activityMinutes,
  }] : []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(isEnglish ? "Remove this Lumo device set?" : "Xóa bộ thiết bị Lumo này?")) return;
    if (isDemoMode && id === mockDevice.id) {
      toast.success(isEnglish ? "Demo device reset" : "Đã thiết lập lại thiết bị demo");
      return;
    }
    setDeletingId(id);
    try {
      await deleteDevice(id);
      toast.success(isEnglish ? "Device removed" : "Đã xóa thiết bị");
    } catch {
      toast.error(isEnglish ? "Could not remove device" : "Không thể xóa thiết bị");
    } finally {
      setDeletingId(null);
    }
  };

  const copy = isEnglish
    ? { title: "My devices", count: `${effectiveDevices.length} connected sets`, add: "Add device", loading: "Loading devices..." }
    : { title: "Thiết bị của tôi", count: `${effectiveDevices.length} bộ đã kết nối`, add: "Thêm thiết bị", loading: "Đang tải thiết bị..." };

  return (
    <main className="devices-page">
      <header className="devices-page-heading">
        <div>
          <p className="lumo-kicker">LUMO CARE</p>
          <h1>{copy.title}</h1>
          <span>{copy.count}</span>
        </div>
        {effectiveDevices.length > 0 && (
          <button type="button" onClick={() => setShowAdd(true)}><Plus size={18} />{copy.add}</button>
        )}
      </header>

      {loading ? (
        <div className="devices-loading"><i /><span>{copy.loading}</span></div>
      ) : effectiveDevices.length === 0 && !isDemoMode ? (
        <EmptyDevices onAdd={() => setShowAdd(true)} isEnglish={isEnglish} />
      ) : isDemoMode && mockProfiles ? (
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 pl-1">
              {isEnglish ? "LUMO BANDS (WEARABLES)" : "VÒNG ĐEO TAY (LUMO BAND)"}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mockProfiles.filter(p => p.type === "band").map(p => {
                const bData = getBatteryData(p.batteryLevel);
                return (
                  <article
                    key={p.id}
                    onClick={() => setInfoTarget({ profile: p, type: "band" })}
                    className="device-product-card band cursor-pointer hover:border-teal-500/50 transition-all active:scale-[0.99]"
                  >
                    <div className="device-product-main">
                      <div className="device-product-media band">
                        <Image src="/products/lumo-band-indigo-diamond.webp" alt="Lumo Band" width={700} height={700} sizes="132px" />
                      </div>
                      <div className="device-product-copy">
                        <div className={`device-connection online`}><i />{isEnglish ? "Connected" : "Đã kết nối"}</div>
                        <p className="lumo-kicker">GÁN CHO: {p.icon} {formatDisplayPersonName(p.name).toUpperCase()}</p>
                        <h2>Lumo Band</h2>
                        <span className="device-code">ID {p.device_id}</span>
                        <div className="band-battery-value"><BatteryMedium size={20} /><strong>{bData.level === null ? "--" : bData.level}%</strong></div>
                        <div className="band-battery-track" aria-label="Pin">
                          <i style={{ width: `${bData.level ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 pl-1">
              {isEnglish ? "LUMO HUBS (SMART SPEAKER)" : "THIẾT BỊ TRUNG TÂM (LUMO HUB)"}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mockProfiles.filter(p => p.type === "hub").map(p => (
                <article
                  key={p.id}
                  onClick={() => setInfoTarget({ profile: p, type: "hub" })}
                  className="device-product-card hub cursor-pointer hover:border-teal-500/50 transition-all active:scale-[0.99]"
                >
                  <div className="device-product-main">
                    <div className="device-product-media hub">
                      <Image src="/products/lumo-hub-studio.webp" alt="Lumo Hub" width={800} height={800} sizes="132px" />
                    </div>
                    <div className="device-product-copy">
                      <div className={`device-connection ${p.hubOnline ? "online" : "offline"}`}><i />{p.hubOnline ? (isEnglish ? "Connected" : "Đã kết nối") : "Mất kết nối"}</div>
                      <p className="lumo-kicker">VỊ TRÍ: {p.icon} {p.name.toUpperCase()}</p>
                      <h2>Lumo Hub</h2>
                      <span className="device-code">ID {p.device_id}</span>
                      <div className="device-detail-line">
                        {p.hubOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
                        <span>{isEnglish ? "Home connection" : "Kết nối mạng ổn định"}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="device-pair-list">
          {effectiveDevices.map((device) => (
            <DevicePair
              key={device.id}
              device={device}
              isEnglish={isEnglish}
              deleting={deletingId === device.id}
              onDelete={() => void handleDelete(device.id)}
              onNotify={() => setNotifyTarget(device)}
              onShowQR={() => setQrTarget(device)}
              onShowInfo={(type) => setInfoTarget({ device, type })}
            />
          ))}
        </div>
      )}

      <AddDeviceModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={fetchDevices} />
      {qrTarget && <DeviceQRModal device={qrTarget} onClose={() => setQrTarget(null)} isEnglish={isEnglish} />}
      {notifyTarget && <NotifyModal device={notifyTarget} onClose={() => setNotifyTarget(null)} isEnglish={isEnglish} />}
      {infoTarget && <DeviceInfoModal profile={infoTarget.profile} device={infoTarget.device} type={infoTarget.type} onClose={() => setInfoTarget(null)} isEnglish={isEnglish} />}
    </main>
  );
}

