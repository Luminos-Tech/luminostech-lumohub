"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { useState } from "react";
import { User, Lock, Save } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(2, "Tên quá ngắn"),
  phone: z.string().optional(),
  avatar_url: z.string().url("URL không hợp lệ").optional().or(z.literal("")),
});

const pwSchema = z.object({
  old_password: z.string().min(6),
  new_password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PwForm = z.infer<typeof pwSchema>;

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [msg, setMsg] = useState("");

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: user?.full_name || "", phone: user?.phone || "", avatar_url: user?.avatar_url || "" },
  });

  const pwForm = useForm<PwForm>({ resolver: zodResolver(pwSchema) });

  const saveProfile = async (data: ProfileForm) => {
    const res = await api.patch("/users/me", data);
    setUser(res.data);
    setMsg("Cập nhật thành công!");
    setTimeout(() => setMsg(""), 3000);
  };

  const changePassword = async (data: PwForm) => {
    await api.patch("/users/me/password", data);
    pwForm.reset();
    setMsg("Đổi mật khẩu thành công!");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Cài đặt</h1>

      {msg && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
        {[{ key: "profile", label: "Hồ sơ", icon: User }, { key: "password", label: "Mật khẩu", icon: Lock }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "profile" | "password")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input {...profileForm.register("full_name")} className="input-field" />
            {profileForm.formState.errors.full_name && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.full_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input {...profileForm.register("phone")} className="input-field" placeholder="0901234567" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh đại diện</label>
            <input {...profileForm.register("avatar_url")} className="input-field" placeholder="https://..." />
          </div>
          <button type="submit" className="btn-primary" disabled={profileForm.formState.isSubmitting}>
            <Save size={15} />{profileForm.formState.isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </form>
      )}

      {tab === "password" && (
        <form onSubmit={pwForm.handleSubmit(changePassword)} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
            <input type="password" {...pwForm.register("old_password")} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
            <input type="password" {...pwForm.register("new_password")} className="input-field" />
            {pwForm.formState.errors.new_password && <p className="text-red-500 text-xs mt-1">{pwForm.formState.errors.new_password.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={pwForm.formState.isSubmitting}>
            <Lock size={15} />{pwForm.formState.isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
          </button>
        </form>
      )}
    </div>
  );
}
