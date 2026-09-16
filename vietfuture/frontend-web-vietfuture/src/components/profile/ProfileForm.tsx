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
        <input {...register("full_name")} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-150 placeholder:text-gray-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
        <input {...register("phone")} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-150 placeholder:text-gray-400" placeholder="0901234567" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh đại diện</label>
        <input {...register("avatar_url")} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-150 placeholder:text-gray-400" placeholder="https://..." />
      </div>
      {saved && <p className="text-sm text-green-600">✓ Đã lưu thay đổi</p>}
      <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md" disabled={isSubmitting}>
        <Save size={15} /> {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
