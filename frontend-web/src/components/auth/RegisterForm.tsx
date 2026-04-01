"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { useState } from "react";
import { User, Mail, Lock } from "lucide-react";

const schema = z.object({
  full_name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirm_password"],
});
type FormData = z.infer<typeof schema>;

export default function RegisterForm() {
  const { register: registerUser } = useAuthStore();
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await registerUser(data.full_name, data.email, data.password);
      router.push("/login?registered=1");
    } catch (e: any) {
      setServerError(e?.response?.data?.detail || "Đăng ký thất bại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-gray-900">Tạo tài khoản</h2>
        <p className="text-gray-500 text-sm">Bắt đầu quản lý lịch thông minh</p>
      </div>

      {serverError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {serverError}
        </div>
      )}

      {[
        { name: "full_name", label: "Họ và tên", placeholder: "Nguyễn Văn A", icon: User, type: "text" },
        { name: "email", label: "Email", placeholder: "ban@email.com", icon: Mail, type: "email" },
        { name: "password", label: "Mật khẩu", placeholder: "••••••••", icon: Lock, type: "password" },
        { name: "confirm_password", label: "Xác nhận mật khẩu", placeholder: "••••••••", icon: Lock, type: "password" },
      ].map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
          <div className="relative">
            <field.icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              {...register(field.name as keyof FormData)}
              type={field.type}
              placeholder={field.placeholder}
              className="input-field pl-9"
            />
          </div>
          {errors[field.name as keyof FormData] && (
            <p className="mt-1 text-xs text-red-500">{errors[field.name as keyof FormData]?.message}</p>
          )}
        </div>
      ))}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
        {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-primary-600 font-medium hover:underline">Đăng nhập</Link>
      </p>
    </form>
  );
}
