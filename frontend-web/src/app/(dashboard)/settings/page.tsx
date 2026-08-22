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
  Heart,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
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
import { useDemoStore } from "@/demo/store";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";
import { OPEN_AUTH_EVENT } from "@/lib/uiEvents";
import { APP_VERSION } from "@/lib/version";


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
  elderly_count: z.union([z.literal(1), z.literal(2)]).default(1),
  elderly_name: z.string().min(2, "Vui lòng nhập tên Ông/bà"),
  elderly_phone: z.string().optional(),
  elderly_name_2: z.string().optional(),
  elderly_phone_2: z.string().optional(),
  address: z.string().optional(),
}).refine(data => {
  if (data.elderly_count === 2 && (!data.elderly_name_2 || data.elderly_name_2.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Vui lòng nhập tên người thứ 2",
  path: ["elderly_name_2"],
});

const sosSchema = z.object({
  neighbor_name: z.string().optional(),
  neighbor_phone: z.string().optional(),
});

const accountSchema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ tên đầy đủ"),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  phone: z.string().optional(),
  old_password: z.string().optional(),
  new_password: z.string().optional(),
}).refine(data => {
  if (data.new_password && !data.old_password) {
    return false;
  }
  return true;
}, {
  message: "Vui lòng nhập mật khẩu hiện tại nếu muốn đổi",
  path: ["old_password"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type SosForm = z.infer<typeof sosSchema>;
type AccountForm = z.infer<typeof accountSchema>;

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, isAuthenticated, logout } = useAuthStore();
  const { isDemoMode, mockUser, disableDemoMode } = useDemoStore();
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showEditSosModal, setShowEditSosModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [pushLoading, setPushLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioInstanceRef = useState<HTMLAudioElement | null>(null);

  const { language, theme, aiVoice, aiVoiceEn, aiVoiceRate, pushEnabled, setLanguage, setTheme, setAiVoice, setAiVoiceEn, setAiVoiceRate, setPushEnabled } = usePreferenceStore();

  // Lấy voiceId hiện tại theo ngôn ngữ
  const currentVoiceId = language === "vi" ? aiVoice : aiVoiceEn;

  const playVoicePreview = async (voiceId: string, rate: number) => {
    // Dừng âm thanh đang phát nếu người dùng bấm lại
    if (isPlayingVoice) {
      if (typeof window !== "undefined") {
        const audios = document.querySelectorAll("audio");
        audios.forEach((a) => {
          a.pause();
          a.currentTime = 0;
        });
      }
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
          toast.error(language === "vi" ? "Lỗi phát âm thanh" : "Audio playback error");
        };

        await audio.play();
        return;
      } else {
        toast.error(language === "vi" ? "Không thể tải giọng đọc thử" : "Failed to load voice preview");
      }
    } catch {
      toast.error(language === "vi" ? "Lỗi kết nối âm thanh" : "Audio connection error");
    }
    setIsPlayingVoice(false);
  };




  const activeUser = user || (isDemoMode ? mockUser : null);

  const preferenceText = language === "vi"
    ? { title: "Tùy chọn ứng dụng", subtitle: "Cá nhân hóa ngôn ngữ và giao diện.", language: "Ngôn ngữ", theme: "Giao diện", light: "Sáng", dark: "Tối", account: "Tài khoản", profile: "Hồ sơ của bạn", profileHint: "Quản lý thông tin cá nhân và bảo mật tại một nơi.", protected: "Đã bảo vệ", devices: "Thiết bị", devicesHint: "Kết nối vòng đeo tay", checkin: "Lời nhắn", checkinHint: "Ghi âm giọng nói cho Lumo Hub", notifications: "Thông báo", notificationsHint: "Xem cảnh báo mới nhất", personal: "Thông tin Ông/Bà", personalHint: "Hồ sơ cá nhân & địa chỉ", sosTitle: "Liên hệ S.O.S", sosHint: "Hàng xóm / Trợ giúp khẩn cấp", name: "Tên Ông/Bà", phone: "Số điện thoại", save: "Lưu thay đổi", saving: "Đang lưu...", password: "Đổi mật khẩu", passwordHint: "Nên thay đổi định kỳ để bảo vệ tài khoản", currentPassword: "Mật khẩu hiện tại", newPassword: "Mật khẩu mới", confirmPassword: "Xác nhận mật khẩu mới", comfort: "Thông báo an tâm", comfortHint: "Nhận cảnh báo điểm danh và thiết bị", enabled: "Đang bật", logout: "Đăng xuất" }
    : { title: "App preferences", subtitle: "Personalize language and appearance.", language: "Language", theme: "Appearance", light: "Light", dark: "Dark", account: "Account", profile: "Your profile", profileHint: "Manage your personal details and security in one place.", protected: "Protected", devices: "Devices", devicesHint: "Connect your wearable band", checkin: "Voice messages", checkinHint: "Record familiar messages for Lumo Hub", notifications: "Notifications", notificationsHint: "View the latest alerts", personal: "Elderly Profile", personalHint: "Personal info & address", sosTitle: "S.O.S Contacts", sosHint: "Neighbors & emergency help", name: "Elderly Name", phone: "Phone number", save: "Save changes", saving: "Saving...", password: "Change password", passwordHint: "Update it regularly to protect your account", currentPassword: "Current password", newPassword: "New password", confirmPassword: "Confirm new password", comfort: "Care notifications", comfortHint: "Receive check-in and device alerts", enabled: "Enabled", logout: "Sign out" };

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { 
      elderly_count: activeUser?.elderly_count || 1,
      elderly_name: activeUser?.elderly_name || "", 
      elderly_phone: activeUser?.elderly_phone || "", 
      elderly_name_2: activeUser?.elderly_name_2 || "",
      elderly_phone_2: activeUser?.elderly_phone_2 || "",
      address: activeUser?.address || "" 
    },
  });
  const sos = useForm<SosForm>({
    resolver: zodResolver(sosSchema),
    defaultValues: { neighbor_name: activeUser?.neighbor_name || "", neighbor_phone: activeUser?.neighbor_phone || "" },
  });
  const account = useForm<AccountForm>({ 
    resolver: zodResolver(accountSchema),
    defaultValues: { full_name: activeUser?.full_name || "", email: activeUser?.email || "", phone: activeUser?.phone || "" }
  });

  useEffect(() => {
    profile.reset({ 
      elderly_count: activeUser?.elderly_count || 1,
      elderly_name: activeUser?.elderly_name || "", 
      elderly_phone: activeUser?.elderly_phone || "", 
      elderly_name_2: activeUser?.elderly_name_2 || "",
      elderly_phone_2: activeUser?.elderly_phone_2 || "",
      address: activeUser?.address || "" 
    });
    sos.reset({ neighbor_name: activeUser?.neighbor_name || "", neighbor_phone: activeUser?.neighbor_phone || "" });
    account.reset({ full_name: activeUser?.full_name || "", email: activeUser?.email || "", phone: activeUser?.phone || "" });
  }, [profile, sos, account, activeUser]);


  const saveProfile = async (data: ProfileForm) => {
    try {
      if (isDemoMode) {
        useDemoStore.getState().setMockUser({ 
          elderly_count: data.elderly_count,
          elderly_name: data.elderly_name, 
          elderly_phone: data.elderly_phone, 
          elderly_name_2: data.elderly_name_2,
          elderly_phone_2: data.elderly_phone_2,
          address: data.address 
        });
        setShowEditProfileModal(false);
        toast.success(language === "vi" ? "Đã cập nhật thông tin hồ sơ" : "Profile updated successfully");
        return;
      }

      if (isAuthenticated) {
        const response = await api.patch("/users/me", data);
        setUser(response.data);
      }
      setShowEditProfileModal(false);
      toast.success(language === "vi" ? "Đã cập nhật thông tin hồ sơ" : "Profile updated successfully");
    } catch {
      toast.error(language === "vi" ? "Không thể lưu thay đổi" : "Could not save changes");
    }
  };

  const saveSos = async (data: SosForm) => {
    try {
      if (isDemoMode) {
        useDemoStore.getState().setMockUser({ neighbor_name: data.neighbor_name, neighbor_phone: data.neighbor_phone });
        setShowEditSosModal(false);
        toast.success(language === "vi" ? "Đã cập nhật liên hệ khẩn cấp" : "S.O.S contacts updated");
        return;
      }
      
      if (isAuthenticated) {
        const response = await api.patch("/users/me", data);
        setUser(response.data);
      }
      setShowEditSosModal(false);
      toast.success(language === "vi" ? "Đã cập nhật liên hệ khẩn cấp" : "S.O.S contacts updated");
    } catch {
      toast.error(language === "vi" ? "Không thể lưu thay đổi" : "Could not save changes");
    }
  };


  const saveAccount = async (data: AccountForm) => {
    try {
      if (isDemoMode) {
        useDemoStore.getState().setMockUser({ full_name: data.full_name, email: data.email, phone: data.phone });
        if (data.new_password) {
          toast.success(language === "vi" ? "Đã cập nhật thông tin và mật khẩu" : "Account & password updated");
        } else {
          toast.success(language === "vi" ? "Đã cập nhật thông tin tài khoản" : "Account updated");
        }
        setShowAccountModal(false);
        return;
      }
      
      if (isAuthenticated) {
        const response = await api.patch("/users/me", { full_name: data.full_name, email: data.email, phone: data.phone });
        setUser(response.data);

        if (data.old_password && data.new_password) {
          await api.patch("/users/me/password", {
            old_password: data.old_password,
            new_password: data.new_password,
          });
        }
      }
      setShowAccountModal(false);
      toast.success(language === "vi" ? "Đã lưu thay đổi" : "Changes saved");
    } catch {
      toast.error(language === "vi" ? "Lưu thay đổi thất bại" : "Update failed");
    }
  };


  const handleLogout = async () => {
    if (isDemoMode) {
      disableDemoMode();
    }
    await logout();
    router.replace("/dashboard");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
    }, 120);
  };

  const togglePushNotifications = async () => {
    setPushLoading(true);
    // Giả lập delay mạng một chút cho giống thật
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    const newState = !pushEnabled;
    setPushEnabled(newState);
    setPushLoading(false);
    
    if (newState) {
      toast.success(language === "vi" ? "Đã bật thông báo an tâm" : "Care notifications enabled");
    } else {
      toast.info(language === "vi" ? "Đã tắt thông báo an tâm" : "Care notifications disabled");
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

      <button 
        type="button" 
        onClick={() => setShowAccountModal(true)} 
        className="account-identity w-full text-left cursor-pointer transition-transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-2xl"
      >
        <div className="account-avatar">{initials}</div>
        <div>
          <strong>{activeUser?.full_name || "LUMO User"}</strong>
          <span><Mail size={14} />{activeUser?.email || "user@lumohub.vn"}</span>
        </div>
        <span className="account-verified"><ShieldCheck size={15} /> {preferenceText.protected}</span>
      </button>


      <section className="account-section compact" aria-label="Account Settings">
        <button
          type="button"
          onClick={() => setShowEditProfileModal(true)}
          className="account-action cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <UserRound size={20} />
          </span>
          <div className="text-left">
            <strong className="text-slate-900 dark:text-[#edf8f8]">{preferenceText.personal}</strong>
            <small className="text-slate-500 dark:text-[#98adb2] block">
              {preferenceText.personalHint}
            </small>
          </div>
          <div className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 font-semibold px-2 py-1 rounded-lg bg-teal-500/10">
            <Edit3 size={13} />
            <span>{language === "en" ? "Edit" : "Sửa"}</span>
          </div>
        </button>

        <div className="account-divider" />



        <button
          type="button"
          onClick={() => setShowEditSosModal(true)}
          className="account-action cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <Heart size={20} />
          </span>
          <div className="text-left">
            <strong className="text-slate-900 dark:text-[#edf8f8]">{preferenceText.sosTitle}</strong>
            <small className="text-slate-500 dark:text-[#98adb2] block">{preferenceText.sosHint}</small>
          </div>
          <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold px-2 py-1 rounded-lg bg-rose-500/10">
            <Edit3 size={13} />
            <span>{language === "en" ? "Edit" : "Sửa"}</span>
          </div>
        </button>

        <div className="account-divider" />

        <button
          type="button"
          onClick={() => void togglePushNotifications()}
          disabled={pushLoading}
          className="account-action cursor-pointer"
        >
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            pushEnabled
              ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
              : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
          }`}>
            <BellRing size={20} />
          </span>
          <div className="text-left">
            <strong className="text-slate-900 dark:text-[#edf8f8]">{preferenceText.comfort}</strong>
            <small className="text-slate-500 dark:text-[#98adb2] block">{preferenceText.comfortHint}</small>
          </div>
          <span className={`px-2 py-1 text-[10px] font-bold rounded-md flex items-center justify-center min-w-[48px] transition-colors ${
            pushEnabled
              ? "bg-teal-500/15 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400"
              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}>
            {pushLoading
              ? <Loader2 className="animate-spin" size={14} />
              : pushEnabled
                ? preferenceText.enabled
                : language === "vi"
                  ? "Bật"
                  : "Enable"}
          </span>
        </button>
      </section>

      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={() => setShowEditProfileModal(false)}>
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#102a31] border border-slate-200 dark:border-[rgba(200,229,232,0.16)] shadow-2xl p-6 text-slate-800 dark:text-[#edf8f8]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">{preferenceText.personal}</h3>
                  <p className="text-xs text-slate-500 dark:text-[#98adb2]">{preferenceText.personalHint}</p>
                </div>
              </div>
            </div>

            <form onSubmit={profile.handleSubmit(saveProfile)} className="space-y-4">
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 mb-2 block">
                  {language === "vi" ? "Số lượng Ông/Bà sử dụng" : "Number of Elderly Users"}
                </label>
                <div className="flex bg-slate-100 dark:bg-[#183840] p-1 rounded-xl">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      profile.watch("elderly_count") === 1 
                        ? "bg-white dark:bg-[#204a55] text-teal-600 dark:text-teal-400 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                    onClick={() => {
                      profile.setValue("elderly_count", 1);
                      profile.setValue("elderly_name_2", "");
                      profile.setValue("elderly_phone_2", "");
                    }}
                  >
                    1 {language === "vi" ? "Người" : "Person"}
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      profile.watch("elderly_count") === 2 
                        ? "bg-white dark:bg-[#204a55] text-teal-600 dark:text-teal-400 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                    onClick={() => profile.setValue("elderly_count", 2)}
                  >
                    2 {language === "vi" ? "Người" : "People"}
                  </button>
                </div>
              </div>

              <label className="account-field">
                <span>{preferenceText.name} {profile.watch("elderly_count") === 2 ? (language === "vi" ? "1 (Ví dụ: Ông)" : "1") : ""}</span>
                <span className="account-input">
                  <UserRound size={18} />
                  <input {...profile.register("elderly_name")} autoComplete="name" />
                </span>
                {profile.formState.errors.elderly_name && <small>{profile.formState.errors.elderly_name.message}</small>}
              </label>

              <label className="account-field">
                <span>{preferenceText.phone} {profile.watch("elderly_count") === 2 ? "1" : ""}</span>
                <span className="account-input">
                  <Phone size={18} />
                  <input {...profile.register("elderly_phone")} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" />
                </span>
              </label>

              {profile.watch("elderly_count") === 2 && (
                <div className="pt-2">
                  <div className="account-divider my-2 border-t border-slate-100 dark:border-slate-800" />
                  
                  <label className="account-field mt-4">
                    <span>{preferenceText.name} {language === "vi" ? "2 (Ví dụ: Bà)" : "2"}</span>
                    <span className="account-input">
                      <UserRound size={18} />
                      <input {...profile.register("elderly_name_2")} autoComplete="name" />
                    </span>
                    {profile.formState.errors.elderly_name_2 && <small className="text-red-500">{profile.formState.errors.elderly_name_2.message}</small>}
                  </label>

                  <label className="account-field mt-4">
                    <span>{preferenceText.phone} 2</span>
                    <span className="account-input">
                      <Phone size={18} />
                      <input {...profile.register("elderly_phone_2")} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" />
                    </span>
                  </label>
                </div>
              )}

              <div className="account-divider my-2 border-t border-slate-100 dark:border-slate-800" />

              <label className="account-field">
                <span>{language === "vi" ? "Địa chỉ nơi ở (của Ông/bà)" : "Home address"}</span>
                <span className="account-input">
                  <MapPin size={18} />
                  <input {...profile.register("address")} placeholder={language === "vi" ? "Số 18, Ngõ 42 Liễu Giai, Ba Đình, Hà Nội" : "18 Lieu Giai, Ba Dinh, Hanoi"} />
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(200,229,232,0.18)] text-xs font-semibold text-slate-600 dark:text-[#c1d2d5] hover:bg-slate-100 dark:hover:bg-[#183840] transition-all"
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

      {showEditSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={() => setShowEditSosModal(false)}>
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#102a31] border border-slate-200 dark:border-[rgba(200,229,232,0.16)] shadow-2xl p-6 text-slate-800 dark:text-[#edf8f8]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Heart size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">{preferenceText.sosTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-[#98adb2]">{preferenceText.sosHint}</p>
                </div>
              </div>
            </div>

            <form onSubmit={sos.handleSubmit(saveSos)} className="space-y-4">
              <label className="account-field">
                <span>{language === "vi" ? "Tên hàng xóm (Liên hệ khẩn cấp)" : "Neighbor Name (Emergency)"}</span>
                <span className="account-input">
                  <UserRound size={18} />
                  <input {...sos.register("neighbor_name")} placeholder={language === "vi" ? "Anh Ba" : "Mr. John"} />
                </span>
              </label>

              <label className="account-field">
                <span>{language === "vi" ? "Số điện thoại hàng xóm" : "Neighbor Phone"}</span>
                <span className="account-input">
                  <Phone size={18} />
                  <input {...sos.register("neighbor_phone")} inputMode="tel" autoComplete="tel" placeholder="0901 234 567" />
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditSosModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(200,229,232,0.18)] text-xs font-semibold text-slate-600 dark:text-[#c1d2d5] hover:bg-slate-100 dark:hover:bg-[#183840] transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={sos.formState.isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {sos.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {sos.formState.isSubmitting ? preferenceText.saving : preferenceText.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onMouseDown={() => setShowAccountModal(false)}>
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#102a31] border border-slate-200 dark:border-[rgba(200,229,232,0.16)] shadow-2xl p-6 text-slate-800 dark:text-[#edf8f8]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                  <UserRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base">{preferenceText.account}</h3>
                  <p className="text-xs text-slate-500 dark:text-[#98adb2]">{preferenceText.personalHint}</p>
                </div>
              </div>
            </div>

            <form onSubmit={account.handleSubmit(saveAccount)} className="space-y-4">
              <label className="account-field">
                <span>{language === "vi" ? "Họ và tên" : "Full Name"}</span>
                <span className="account-input">
                  <UserRound size={18} />
                  <input {...account.register("full_name")} autoComplete="name" />
                </span>
                {account.formState.errors.full_name && <small>{account.formState.errors.full_name.message}</small>}
              </label>

              <label className="account-field">
                <span>Email</span>
                <span className="account-input">
                  <Mail size={18} />
                  <input {...account.register("email")} type="email" autoComplete="email" placeholder="example@gmail.com" />
                </span>
                {account.formState.errors.email && <small>{account.formState.errors.email.message}</small>}
              </label>

              <label className="account-field">
                <span>{language === "vi" ? "Số điện thoại" : "Phone number"}</span>
                <span className="account-input">
                  <Phone size={18} />
                  <input {...account.register("phone")} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" />
                </span>
              </label>

              <div className="account-divider my-2 border-t border-slate-100 dark:border-slate-800" />
              
              <p className="text-xs font-semibold text-slate-500 mb-2">{preferenceText.password}</p>

              <label className="account-field">
                <span>{preferenceText.currentPassword}</span>
                <span className="account-input">
                  <Lock size={18} />
                  <input {...account.register("old_password")} type="password" placeholder="••••••••" />
                </span>
                {account.formState.errors.old_password && <small>{account.formState.errors.old_password.message}</small>}
              </label>

              <label className="account-field">
                <span>{preferenceText.newPassword}</span>
                <span className="account-input">
                  <KeyRound size={18} />
                  <input {...account.register("new_password")} type="password" placeholder="••••••••" />
                </span>
                {account.formState.errors.new_password && <small>{account.formState.errors.new_password.message}</small>}
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(200,229,232,0.18)] text-xs font-semibold text-slate-600 dark:text-[#c1d2d5] hover:bg-slate-100 dark:hover:bg-[#183840] transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={account.formState.isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                >
                  {account.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {account.formState.isSubmitting ? preferenceText.saving : preferenceText.save}
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

        <div className="preference-row flex-wrap">
          <div><Languages size={18} /><strong>{preferenceText.language}</strong></div>
          <div className="preference-toggle w-full sm:w-auto flex" role="group" aria-label={preferenceText.language}>
            <button type="button" className={`flex-1 sm:flex-none ${language === "vi" ? "active" : ""}`} onClick={() => setLanguage("vi")}>Tiếng Việt</button>
            <button type="button" className={`flex-1 sm:flex-none ${language === "en" ? "active" : ""}`} onClick={() => setLanguage("en")}>English</button>
          </div>
        </div>

        <div className="preference-row flex-wrap">
          <div>{theme === "light" ? <Sun size={18} /> : <Moon size={18} />}<strong>{preferenceText.theme}</strong></div>
          <div className="preference-toggle w-full sm:w-auto flex" role="group" aria-label={preferenceText.theme}>
            <button type="button" className={`flex-1 sm:flex-none ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}><Sun size={14} />{preferenceText.light}</button>
            <button type="button" className={`flex-1 sm:flex-none ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}><Moon size={14} />{preferenceText.dark}</button>
          </div>
        </div>

        {/* Tinh gọn Giọng nói LUMO AI */}
        <div className="preference-row flex-wrap">
          <div>
            <Mic size={18} />
            <strong>{language === "vi" ? "Giọng LUMO AI" : "LUMO AI Voice"}</strong>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
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
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[rgba(200,229,232,0.18)] bg-white dark:bg-[#183840] text-slate-800 dark:text-[#edf8f8] cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
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
        <div className="preference-row flex-wrap">
          <div>
            <Sparkles size={18} />
            <strong>{language === "vi" ? "Tốc độ nói" : "Speech speed"}</strong>
          </div>
          <div className="preference-toggle w-full sm:w-auto flex mt-1 sm:mt-0" role="group" aria-label="Speech speed">
            <button
              type="button"
              className={`flex-1 sm:flex-none ${aiVoiceRate === 0.85 ? "active" : ""}`}
              onClick={() => {
                setAiVoiceRate(0.85);
                playVoicePreview(currentVoiceId, 0.85);
              }}
            >
              0.85x ({language === "vi" ? "Chậm" : "Slow"})
            </button>
            <button
              type="button"
              className={`flex-1 sm:flex-none ${aiVoiceRate === 0.95 ? "active" : ""}`}
              onClick={() => {
                setAiVoiceRate(0.95);
                playVoicePreview(currentVoiceId, 0.95);
              }}
            >
              0.95x ({language === "vi" ? "Vừa" : "Normal"})
            </button>
            <button
              type="button"
              className={`flex-1 sm:flex-none ${aiVoiceRate === 1.1 ? "active" : ""}`}
              onClick={() => {
                setAiVoiceRate(1.1);
                playVoicePreview(currentVoiceId, 1.1);
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




