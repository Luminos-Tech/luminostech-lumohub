"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usePreferenceStore } from "@/store/preferenceStore";

const schema = z.object({
  email: z.string().email("Vui lòng nhập đúng địa chỉ email"),
  password: z.string().min(6, "Mật khẩu cần có ít nhất 6 ký tự"),
});
type FormData = z.infer<typeof schema>;

export default function LoginForm({ onSuccess, onSwitchMode }: { onSuccess?: () => void; onSwitchMode?: () => void }) {
  const { login } = useAuthStore();
  const language = usePreferenceStore((state) => state.language);
  const text = language === "vi"
    ? { title: "Đăng nhập", subtitle: "Tiếp tục theo dõi những tín hiệu quan trọng.", email: "Email", password: "Mật khẩu", passwordPlaceholder: "Nhập mật khẩu", show: "Hiện mật khẩu", hide: "Ẩn mật khẩu", loading: "Đang đăng nhập...", submit: "Đăng nhập", prompt: "Chưa có tài khoản?", switch: "Tạo tài khoản" }
    : { title: "Sign in", subtitle: "Continue monitoring the signals that matter.", email: "Email", password: "Password", passwordPlaceholder: "Enter your password", show: "Show password", hide: "Hide password", loading: "Signing in...", submit: "Sign in", prompt: "New to Lumo?", switch: "Create account" };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await login(data.email, data.password);
      if (onSuccess) onSuccess();
      else router.push("/dashboard");
    } catch (error: any) {
      setServerError(error?.response?.data?.detail || "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      <div className="auth-form-heading">
        <p>Chào mừng trở lại</p>
        <h2>{text.title}</h2>
        <span>{text.subtitle}</span>
      </div>

      {searchParams.get("registered") === "1" && (
        <div className="auth-message success" role="status"><CheckCircle2 size={18} /><span>Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.</span></div>
      )}
      {serverError && <div className="auth-message error" role="alert"><AlertCircle size={18} /><span>{serverError}</span></div>}

      <label className="auth-field">
        <span>{text.email}</span>
        <span className="auth-input-wrap">
          <Mail size={18} />
          <input {...register("email")} type="email" inputMode="email" autoComplete="email" placeholder="ban@email.com" aria-invalid={!!errors.email} />
        </span>
        {errors.email && <small>{errors.email.message}</small>}
      </label>

      <label className="auth-field">
        <span>{text.password}</span>
        <span className="auth-input-wrap">
          <Lock size={18} />
          <input {...register("password")} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={text.passwordPlaceholder} aria-invalid={!!errors.password} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? text.hide : text.show}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
        {errors.password && <small>{errors.password.message}</small>}
      </label>

      <button type="submit" disabled={isSubmitting} className="auth-submit">
        {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> {text.loading}</> : text.submit}
      </button>

      <p className="auth-switch">{text.prompt} {onSwitchMode ? <button type="button" onClick={onSwitchMode}>{text.switch}</button> : <Link href="/register">{text.switch}</Link>}</p>
    </form>
  );
}
