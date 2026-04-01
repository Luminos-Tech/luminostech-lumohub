"use client";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { useState } from "react";
import { Save } from "lucide-react";

export default function ProfileForm() {
  const { user, setUser } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      full_name: user?.full_name || "",
      phone: user?.phone || "",
      avatar_url: user?.avatar_url || "",
    },
  });

  const onSubmit = async (data: { full_name: string; phone: string; avatar_url: string }) => {
    const res = await api.patch("/users/me", data);
    setUser(res.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
        <input {...register("full_name")} className="input-field" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
        <input {...register("phone")} className="input-field" placeholder="0901234567" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh đại diện</label>
        <input {...register("avatar_url")} className="input-field" placeholder="https://..." />
      </div>
      {saved && <p className="text-sm text-green-600">✓ Đã lưu thay đổi</p>}
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        <Save size={15} /> {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
