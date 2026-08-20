"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  BellRing,
  AudioLines,
  Check,
  ChevronRight,
  Edit3,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Mic,
  Moon,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { usePreferenceStore, type LumoVoiceIdVi, type LumoVoiceIdEn } from "@/store/preferenceStore";
import { useDemoStore } from "@/store/demoStore";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { APP_VERSION } from "@/lib/version";
import {
  getNotificationPermission,
  initPushNotifications,
  isPushSupported,
  requestNotificationPermission,
} from "@/lib/push-notification";

const VOICE_OPTIONS_VI: Array<{
  id: LumoVoiceIdVi;
  name: string;
  gender: "Nữ" | "Nam";
  accent: string;
  desc: string;
}> = [
  {
    id: "Kore",
    name: "Nhi (Nữ Miền Bắc)",
    gender: "Nữ",
    accent: "Miền Bắc",
    desc: "Ấm áp, tự nhiên, điềm tĩnh (Mặc định)",
  },
  {
    id: "Aoede",
    name: "Thư (Nữ Miền Nam)",
    gender: "Nữ",
    accent: "Miền Nam",
    desc: "Thân thiện, nhẹ nhàng, truyền cảm",
  },
  {
    id: "Puck",
    name: "Kiệt (Nam Miền Bắc)",
    gender: "Nam",
    accent: "Miền Bắc",
    desc: "Truyền cảm, rõ ràng, dõng dạc",
  },
  {
    id: "Fenrir",
    name: "Hà (Nam Miền Nam)",
    gender: "Nam",
    accent: "Miền Nam",
    desc: "Trầm ấm, cẩn trọng, điềm tĩnh",
  },
  {
    id: "Charon",
    name: "Bảo (Nam Giọng Trầm)",
    gender: "Nam",
    accent: "Trầm",
    desc: "Trầm lắng, sâu sắc, tin cậy",
  },
];

const VOICE_OPTIONS_EN: Array<{
  id: LumoVoiceIdEn;
  name: string;
  gender: "Female" | "Male";
  style: string;
  desc: string;
}> = [
  {
    id: "Kore",
    name: "Kore (Warm Female)",
    gender: "Female",
    style: "Warm & Calm",
    desc: "Warm, natural & calm (Default)",
  },
  {
    id: "Zephyr",
    name: "Zephyr (Bright Female)",
    gender: "Female",
    style: "Bright & Friendly",
    desc: "Bright, friendly & cheerful",
  },
  {
    id: "Puck",
    name: "Puck (Expressive Male)",
    gender: "Male",
    style: "Bold & Clear",
    desc: "Clear, bold & expressive",
  },
  {
    id: "Fenrir",
    name: "Fenrir (Steady Male)",
    gender: "Male",
    style: "Warm & Steady",
    desc: "Warm, steady & thoughtful",
  },
  {
    id: "Charon",
    name: "Charon (Deep Male)",
    gender: "Male",
    style: "Deep & Soothing",
    desc: "Deep, soothing & trustworthy",
  },
];

const profileSchema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ tên đầy đủ"),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  old_password: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  new_password: z.string().min(6, "Mật khẩu mới cần ít nhất 6 ký tự"),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, isAuthenticated, logout } = useAuthStore();
  const { isDemoMode, mockUser } = useDemoStore();
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const { language, theme, aiVoice, aiVoiceEn, aiVoiceRate, setLanguage, setTheme, setAiVoice, setAiVoiceEn, setAiVoiceRate } = usePreferenceStore();

  // Lấy voiceId hiện tại theo ngôn ngữ
  const currentVoiceId = language === "vi" ? aiVoice : aiVoiceEn;

  const playVoicePreview = async (voiceId: string, rate: number) => {
    if (isPlayingVoice) {
      setIsPlayingVoice(false);
      return;
    }

    setIsPlayingVoice(true);

    try {
      const previewUrl = `/api/v1/tts/preview?lang=${language}&voice_id=${encodeURIComponent(voiceId)}&speed=${rate}`;
      const res = await fetch(previewUrl);

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = rate;

        audio.onended = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsPlayingVoice(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        return;
      }
    } catch {
      setIsPlayingVoice(false);
    }
    setIsPlayingVoice(false);
  };




  const activeUser = user || (isDemoMode ? mockUser : null);

  const preferenceText = language === "vi"
    ? { title: "Tùy chọn ứng dụng", subtitle: "Cá nhân hóa ngôn ngữ và giao diện.", language: "Ngôn ngữ", theme: "Giao diện", light: "Sáng", dark: "Tối", account: "Tài khoản", profile: "Hồ sơ của bạn", profileHint: "Quản lý thông tin cá nhân và bảo mật tại một nơi.", protected: "Đã bảo vệ", devices: "Thiết bị", devicesHint: "Kết nối vòng đeo tay", checkin: "Lời nhắn", checkinHint: "Ghi âm giọng nói cho Lumo Hub", notifications: "Thông báo", notificationsHint: "Xem cảnh báo mới nhất", personal: "Thông tin cá nhân", personalHint: "Dùng để nhận diện tài khoản Lumo.", name: "Họ và tên", phone: "Số điện thoại", save: "Lưu thay đổi", saving: "Đang lưu...", password: "Đổi mật khẩu", passwordHint: "Nên thay đổi định kỳ để bảo vệ tài khoản", currentPassword: "Mật khẩu hiện tại", newPassword: "Mật khẩu mới", confirmPassword: "Xác nhận mật khẩu mới", comfort: "Thông báo an tâm", comfortHint: "Nhận cảnh báo điểm danh và thiết bị", enabled: "Đang bật", logout: "Đăng xuất" }
    : { title: "App preferences", subtitle: "Personalize language and appearance.", language: "Language", theme: "Appearance", light: "Light", dark: "Dark", account: "Account", profile: "Your profile", profileHint: "Manage your personal details and security in one place.", protected: "Protected", devices: "Devices", devicesHint: "Connect your wearable band", checkin: "Voice messages", checkinHint: "Record familiar messages for Lumo Hub", notifications: "Notifications", notificationsHint: "View the latest alerts", personal: "Personal information", personalHint: "Used to identify your Lumo account.", name: "Full name", phone: "Phone number", save: "Save changes", saving: "Saving...", password: "Change password", passwordHint: "Update it regularly to protect your account", currentPassword: "Current password", newPassword: "New password", confirmPassword: "Confirm new password", comfort: "Care notifications", comfortHint: "Receive check-in and device alerts", enabled: "Enabled", logout: "Sign out" };

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: activeUser?.full_name || "", phone: activeUser?.phone || "" },
  });
  const password = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    profile.reset({ full_name: activeUser?.full_name || "", phone: activeUser?.phone || "" });
  }, [profile, activeUser]);

  useEffect(() => {
    setPushStatus(getNotificationPermission());
  }, []);

  const saveProfile = async (data: ProfileForm) => {
    try {
      if (isAuthenticated) {
        const response = await api.patch("/users/me", data);
        setUser(response.data);
      }
      setShowEditProfileModal(false);
      toast.success("Đã cập nhật thông tin cá nhân");
    } catch {
      toast.error("Không thể lưu thay đổi");
    }
  };


  const changePassword = async (data: PasswordForm) => {
    try {
      await api.patch("/users/me/password", data);
      password.reset();
      setShowChangePasswordModal(false);
      toast.success("Đã đổi mật khẩu thành công");
    } catch {
      toast.error("Không thể đổi mật khẩu");
    }
  };


  const handleLogout = async () => {
    await logout();
    router.replace("/dashboard");
  };

  const enablePushNotifications = async () => {
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      toast.error(language === "vi" ? "Trình duyệt không hỗ trợ thông báo" : "Notifications are not supported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      toast.error(language === "vi" ? "Hãy cho phép thông báo trong cài đặt trình duyệt" : "Allow notifications in browser settings");
      return;
    }

    setPushLoading(true);
    try {
      const granted = Notification.permission === "granted" || await requestNotificationPermission();
      if (!granted) {
        setPushStatus(Notification.permission);
        return;
      }
      const result = await initPushNotifications();
      setPushStatus(Notification.permission);
      if (result.success) {
        toast.success(language === "vi" ? "Đã bật thông báo" : "Notifications enabled");
      } else {
        toast.error(language === "vi" ? "Không thể đăng ký Web Push" : "Could not register Web Push");
      }
    } finally {
      setPushLoading(false);
    }
  };

  const initials = activeUser?.full_name
    ?.split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "LU";

  return (
    <div className="account-page">
      <header className="account-heading">
        <p className="lumo-kicker">{preferenceText.account}</p>
        <h1>{preferenceText.profile}</h1>
        <span>{preferenceText.profileHint}</span>
      </header>

      <section className="account-identity">
        <div className="account-avatar">{initials}</div>
        <div>
          <strong>{activeUser?.full_name || "LUMO User"}</strong>
          <span><Mail size={14} />{activeUser?.email || "user@lumohub.vn"}</span>
        </div>
        <span className="account-verified"><ShieldCheck size={15} /> {preferenceText.protected}</span>
      </section>

      <section className="account-shortcuts" aria-label={language === "en" ? "Quick access" : "Truy cập nhanh"}>
        <Link href="/settings/devices" className="account-shortcut aqua">
          <span><LumoBandIcon size={21} /></span>
          <div><strong>{preferenceText.devices}</strong><small>{preferenceText.devicesHint}</small></div>
          <ChevronRight size={17} />
        </Link>
        <Link href="/settings/event-buttons" className="account-shortcut coral">
          <span><AudioLines size={20} /></span>
          <div><strong>{preferenceText.checkin}</strong><small>{preferenceText.checkinHint}</small></div>
          <ChevronRight size={17} />
        </Link>
        <Link href="/notifications" className="account-shortcut sky">
          <span><BellRing size={20} /></span>
          <div><strong>{preferenceText.notifications}</strong><small>{preferenceText.notificationsHint}</small></div>
          <ChevronRight size={17} />
        </Link>
      </section>

      {/* Cụm Quản lý Tài khoản & Bảo mật Pop-up */}
      <section className="account-section compact" aria-label="Account Settings">
        {/* Row 1: Thông tin cá nhân (Bấm mở Pop-up Modal) */}
        <button
          type="button"
          className="account-action cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-2xl transition-colors"
          onClick={() => setShowEditProfileModal(true)}
        >
          <span className="account-action-icon">
            <UserRound size={19} />
          </span>
          <span>
            <strong className="text-slate-900 dark:text-slate-100">{preferenceText.personal}</strong>
            <small className="text-slate-500 dark:text-slate-400">
              {activeUser?.full_name || "LUMO User"} {activeUser?.phone ? `· ${activeUser.phone}` : ""}
            </small>
          </span>
          <div className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 font-semibold px-2 py-1 rounded-lg bg-teal-500/10">
            <Edit3 size={14} />
            <span>{language === "vi" ? "Sửa" : "Edit"}</span>
          </div>
        </button>

        <div className="account-divider" />

        {/* Row 2: Đổi mật khẩu (Bấm mở Pop-up Modal) */}
        <button
          type="button"
          className="account-action cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-2xl transition-colors"
          onClick={() => setShowChangePasswordModal(true)}
        >
          <span className="account-action-icon">
            <KeyRound size={19} />
          </span>
          <span>
            <strong className="text-slate-900 dark:text-slate-100">{preferenceText.password}</strong>
            <small className="text-slate-500 dark:text-slate-400">{preferenceText.passwordHint}</small>
          </span>
          <ChevronRight size={19} className="text-slate-400" />
        </button>

        <div className="account-divider" />

        {/* Row 3: Thông báo an tâm */}
        <button
          type="button"
          className="account-action cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-3 rounded-2xl transition-colors"
          onClick={() => void enablePushNotifications()}
          disabled={pushLoading}
        >
          <span className="account-action-icon coral">
            <Bell size={19} />
          </span>
          <span>
            <strong className="text-slate-900 dark:text-slate-100">{preferenceText.comfort}</strong>
            <small className="text-slate-500 dark:text-slate-400">{preferenceText.comfortHint}</small>
          </span>
          <span className="status-on">
            {pushLoading
              ? "..."
              : pushStatus === "granted"
                ? preferenceText.enabled
                : language === "vi"
                  ? "Bật"
                  : "Enable"}
          </span>
        </button>
      </section>

      {/* Pop-up Modal: Chỉnh sửa thông tin cá nhân */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">{preferenceText.personal}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{preferenceText.personalHint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={profile.handleSubmit(saveProfile)} className="space-y-4">
              <label className="account-field">
                <span>{preferenceText.name}</span>
                <span className="account-input">
                  <UserRound size={18} />
                  <input {...profile.register("full_name")} autoComplete="name" />
                </span>
                {profile.formState.errors.full_name && <small>{profile.formState.errors.full_name.message}</small>}
              </label>

              <label className="account-field">
                <span>{preferenceText.phone}</span>
                <span className="account-input">
                  <Phone size={18} />
                  <input {...profile.register("phone")} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" />
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={profile.formState.isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {profile.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {profile.formState.isSubmitting ? preferenceText.saving : preferenceText.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Modal: Đổi mật khẩu */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">{preferenceText.password}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{preferenceText.passwordHint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={password.handleSubmit(changePassword)} className="space-y-4">
              <label className="account-field">
                <span>{preferenceText.currentPassword}</span>
                <span className="account-input">
                  <Lock size={18} />
                  <input type="password" {...password.register("old_password")} autoComplete="current-password" />
                </span>
                {password.formState.errors.old_password && <small>{password.formState.errors.old_password.message}</small>}
              </label>

              <label className="account-field">
                <span>{preferenceText.newPassword}</span>
                <span className="account-input">
                  <Lock size={18} />
                  <input type="password" {...password.register("new_password")} autoComplete="new-password" />
                </span>
                {password.formState.errors.new_password && <small>{password.formState.errors.new_password.message}</small>}
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={password.formState.isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {password.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {preferenceText.confirmPassword}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Tùy chọn ứng dụng (Ngôn ngữ, Giao diện & Giọng LUMO AI tinh gọn) */}
      <section className="account-section preference-section">
        <div className="account-section-title">
          <span><Languages size={19} /></span>
          <div><h2>{preferenceText.title}</h2><p>{preferenceText.subtitle}</p></div>
        </div>

        <div className="preference-row">
          <div><Languages size={18} /><strong>{preferenceText.language}</strong></div>
          <div className="preference-toggle" role="group" aria-label={preferenceText.language}>
            <button type="button" className={language === "vi" ? "active" : ""} onClick={() => setLanguage("vi")}>Tiếng Việt</button>
            <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
          </div>
        </div>

        <div className="preference-row">
          <div>{theme === "light" ? <Sun size={18} /> : <Moon size={18} />}<strong>{preferenceText.theme}</strong></div>
          <div className="preference-toggle" role="group" aria-label={preferenceText.theme}>
            <button type="button" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={14} />{preferenceText.light}</button>
            <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={14} />{preferenceText.dark}</button>
          </div>
        </div>

        {/* Tinh gọn Giọng nói LUMO AI */}
        <div className="preference-row">
          <div>
            <Mic size={18} />
            <strong>{language === "vi" ? "Giọng LUMO AI" : "LUMO AI Voice"}</strong>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={currentVoiceId}
              onChange={(e) => {
                const newVoice = e.target.value;
                if (language === "vi") {
                  setAiVoice(newVoice as LumoVoiceIdVi);
                } else {
                  setAiVoiceEn(newVoice as LumoVoiceIdEn);
                }
                playVoicePreview(newVoice, aiVoiceRate);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
            >
              {language === "vi"
                ? VOICE_OPTIONS_VI.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))
                : VOICE_OPTIONS_EN.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))
              }
            </select>
            <button
              type="button"
              onClick={() => playVoicePreview(currentVoiceId, aiVoiceRate)}
              title={language === "vi" ? "Nghe thử giọng" : "Preview voice"}
              className="p-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 transition-all shrink-0 active:scale-95"
            >
              {isPlayingVoice ? <Square size={14} fill="currentColor" /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* Tinh gọn Tốc độ nói */}
        <div className="preference-row">
          <div>
            <Sparkles size={18} />
            <strong>{language === "vi" ? "Tốc độ nói" : "Speech speed"}</strong>
          </div>
          <div className="preference-toggle" role="group" aria-label="Speech speed">
            <button
              type="button"
              className={aiVoiceRate === 0.85 ? "active" : ""}
              onClick={() => {
                setAiVoiceRate(0.85);
                playVoicePreview(aiVoice, 0.85);
              }}
            >
              0.85x ({language === "vi" ? "Chậm" : "Slow"})
            </button>
            <button
              type="button"
              className={aiVoiceRate === 0.95 ? "active" : ""}
              onClick={() => {
                setAiVoiceRate(0.95);
                playVoicePreview(aiVoice, 0.95);
              }}
            >
              0.95x ({language === "vi" ? "Vừa" : "Normal"})
            </button>
            <button
              type="button"
              className={aiVoiceRate === 1.1 ? "active" : ""}
              onClick={() => {
                setAiVoiceRate(1.1);
                playVoicePreview(aiVoice, 1.1);
              }}
            >
              1.1x ({language === "vi" ? "Nhanh" : "Fast"})
            </button>
          </div>
        </div>
      </section>

      <button className="account-logout" type="button" onClick={handleLogout}><LogOut size={19} /> {preferenceText.logout}</button>
      <p className="account-version">
        {language === "vi" ? "Lumo phiên bản" : "Lumo version"} {APP_VERSION} · LuminosTech
      </p>
    </div>
  );
}




