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
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Moon,
  Phone,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { usePreferenceStore } from "@/store/preferenceStore";
import { LumoBandIcon } from "@/components/icons/LumoDeviceIcons";

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
  const { user, setUser, logout } = useAuthStore();
  const [showSecurity, setShowSecurity] = useState(false);
  const { language, theme, setLanguage, setTheme } = usePreferenceStore();
  const preferenceText = language === "vi"
    ? { title: "Tùy chọn ứng dụng", subtitle: "Cá nhân hóa ngôn ngữ và giao diện.", language: "Ngôn ngữ", theme: "Giao diện", light: "Sáng", dark: "Tối", account: "Tài khoản", profile: "Hồ sơ của bạn", profileHint: "Quản lý thông tin cá nhân và bảo mật tại một nơi.", protected: "Đã bảo vệ", devices: "Thiết bị", devicesHint: "Kết nối vòng đeo tay", checkin: "Lời nhắn", checkinHint: "Ghi âm giọng nói cho Lumo Hub", notifications: "Thông báo", notificationsHint: "Xem cảnh báo mới nhất", personal: "Thông tin cá nhân", personalHint: "Dùng để nhận diện tài khoản Lumo.", name: "Họ và tên", phone: "Số điện thoại", save: "Lưu thay đổi", saving: "Đang lưu...", password: "Đổi mật khẩu", passwordHint: "Nên thay đổi định kỳ để bảo vệ tài khoản", currentPassword: "Mật khẩu hiện tại", newPassword: "Mật khẩu mới", confirmPassword: "Xác nhận mật khẩu mới", comfort: "Thông báo an tâm", comfortHint: "Nhận cảnh báo điểm danh và thiết bị", enabled: "Đang bật", logout: "Đăng xuất", version: "Lumo phiên bản 1.0 · LuminosTech" }
    : { title: "App preferences", subtitle: "Personalize language and appearance.", language: "Language", theme: "Appearance", light: "Light", dark: "Dark", account: "Account", profile: "Your profile", profileHint: "Manage your personal details and security in one place.", protected: "Protected", devices: "Devices", devicesHint: "Connect your wearable band", checkin: "Voice messages", checkinHint: "Record familiar messages for Lumo Hub", notifications: "Notifications", notificationsHint: "View the latest alerts", personal: "Personal information", personalHint: "Used to identify your Lumo account.", name: "Full name", phone: "Phone number", save: "Save changes", saving: "Saving...", password: "Change password", passwordHint: "Update it regularly to protect your account", currentPassword: "Current password", newPassword: "New password", confirmPassword: "Confirm new password", comfort: "Care notifications", comfortHint: "Receive check-in and device alerts", enabled: "Enabled", logout: "Sign out", version: "Lumo version 1.0 · LuminosTech" };

  const profile = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name || "", phone: user?.phone || "" },
  });
  const password = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    profile.reset({ full_name: user?.full_name || "", phone: user?.phone || "" });
  }, [profile, user]);

  const saveProfile = async (data: ProfileForm) => {
    try {
      const response = await api.patch("/users/me", data);
      setUser(response.data);
      toast.success("Đã lưu thông tin tài khoản");
    } catch {
      toast.error("Không thể lưu thay đổi");
    }
  };

  const changePassword = async (data: PasswordForm) => {
    try {
      await api.patch("/users/me/password", data);
      password.reset();
      setShowSecurity(false);
      toast.success("Đã đổi mật khẩu");
    } catch {
      toast.error("Không thể đổi mật khẩu");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/dashboard");
  };

  const initials = user?.full_name
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
          <strong>{user?.full_name}</strong>
          <span><Mail size={14} />{user?.email}</span>
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

      <form onSubmit={profile.handleSubmit(saveProfile)} className="account-section">
        <div className="account-section-title">
          <span><UserRound size={19} /></span>
          <div><h2>{preferenceText.personal}</h2><p>{preferenceText.personalHint}</p></div>
        </div>

        <label className="account-field">
          <span>{preferenceText.name}</span>
          <span className="account-input"><UserRound size={18} /><input {...profile.register("full_name")} autoComplete="name" /></span>
          {profile.formState.errors.full_name && <small>{profile.formState.errors.full_name.message}</small>}
        </label>
        <label className="account-field">
          <span>{preferenceText.phone}</span>
          <span className="account-input"><Phone size={18} /><input {...profile.register("phone")} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" /></span>
        </label>

        <button className="account-save" type="submit" disabled={profile.formState.isSubmitting}>
          {profile.formState.isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {profile.formState.isSubmitting ? preferenceText.saving : preferenceText.save}
        </button>
      </form>

      <section className="account-section compact">
        <button className="account-action" type="button" onClick={() => setShowSecurity((value) => !value)} aria-expanded={showSecurity}>
          <span className="account-action-icon"><KeyRound size={19} /></span>
          <span><strong>{preferenceText.password}</strong><small>{preferenceText.passwordHint}</small></span>
          <ChevronRight size={19} className={showSecurity ? "rotate-90" : ""} />
        </button>

        {showSecurity && (
          <form onSubmit={password.handleSubmit(changePassword)} className="security-form">
            <label className="account-field">
              <span>{preferenceText.currentPassword}</span>
              <span className="account-input"><Lock size={18} /><input type="password" {...password.register("old_password")} autoComplete="current-password" /></span>
              {password.formState.errors.old_password && <small>{password.formState.errors.old_password.message}</small>}
            </label>
            <label className="account-field">
              <span>{preferenceText.newPassword}</span>
              <span className="account-input"><Lock size={18} /><input type="password" {...password.register("new_password")} autoComplete="new-password" /></span>
              {password.formState.errors.new_password && <small>{password.formState.errors.new_password.message}</small>}
            </label>
            <button className="account-save secondary" type="submit" disabled={password.formState.isSubmitting}>
              {password.formState.isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {preferenceText.confirmPassword}
            </button>
          </form>
        )}

        <div className="account-divider" />
        <div className="account-action static">
          <span className="account-action-icon coral"><Bell size={19} /></span>
          <span><strong>{preferenceText.comfort}</strong><small>{preferenceText.comfortHint}</small></span>
          <span className="status-on">{preferenceText.enabled}</span>
        </div>
      </section>

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
      </section>

      <button className="account-logout" type="button" onClick={handleLogout}><LogOut size={19} /> {preferenceText.logout}</button>
      <p className="account-version">{preferenceText.version}</p>
    </div>
  );
}
