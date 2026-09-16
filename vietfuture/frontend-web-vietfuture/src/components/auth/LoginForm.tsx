"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useDemoStore } from "@/demo/store";
import { usePreferenceStore } from "@/store/preferenceStore";

const REMEMBER_KEY = "lumohub-login-remember";

const schema = z.object({
  email: z.string().email("Vui lòng nhập đúng địa chỉ email"),
  password: z.string().min(6, "Mật khẩu cần có ít nhất 6 ký tự"),
});
type FormData = z.infer<typeof schema>;

export default function LoginForm({ onSuccess, onSwitchMode, onForgotPassword }: {
  onSuccess?: () => void;
  onSwitchMode?: () => void;
  onForgotPassword?: () => void;
}) {
  const { login } = useAuthStore();
  const language = usePreferenceStore((state) => state.language);
  const text = language === "vi"
    ? {
        title: "Đăng nhập",
        subtitle: "Tiếp tục theo dõi những tín hiệu quan trọng.",
        email: "Email",
        emailPlaceholder: "ban@email.com",
        password: "Mật khẩu",
        passwordPlaceholder: "Nhập mật khẩu",
        show: "Hiện mật khẩu",
        hide: "Ẩn mật khẩu",
        remember: "Ghi nhớ tôi",
        forgot: "Quên mật khẩu?",
        loading: "Đang đăng nhập...",
        submit: "Đăng nhập",
        prompt: "Chưa có tài khoản?",
        switch: "Tạo tài khoản",
        securityBadge: "Mã hóa đầu cuối · Chỉ bạn truy cập được",
        successBanner: "Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.",
        genericError: "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.",
      }
    : {
        title: "Sign in",
        subtitle: "Continue monitoring the signals that matter.",
        email: "Email",
        emailPlaceholder: "you@email.com",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        show: "Show password",
        hide: "Hide password",
        remember: "Remember me",
        forgot: "Forgot password?",
        loading: "Signing in...",
        submit: "Sign in",
        prompt: "New to Lumo?",
        switch: "Create account",
        securityBadge: "End-to-end encrypted · Only you can access",
        successBanner: "Account created. You can sign in now.",
        genericError: "Cannot sign you in. Please double-check your details.",
      };

  const isDemoMode = useDemoStore((state) => state.isDemoMode);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const rememberedEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(REMEMBER_KEY) ?? ""; } catch { return ""; }
  }, []);

  useEffect(() => {
    if (rememberedEmail) setRememberMe(true);
  }, [rememberedEmail]);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { email: rememberedEmail, password: "" },
    });

  useEffect(() => {
    if (rememberedEmail) setValue("email", rememberedEmail);
  }, [rememberedEmail, setValue]);

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await login(data.email, data.password);
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, data.email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      if (onSuccess) onSuccess();
      else router.push("/dashboard");
    } catch (error: any) {
      setServerError(error?.response?.data?.detail || text.genericError);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
      if (onSuccess) onSuccess();
      else router.push("/dashboard");
    }
  }, [isDemoMode, onSuccess, router]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      <div className="auth-form-heading">
        <p>{language === "vi" ? "Chào mừng trở lại" : "Welcome back"}</p>
        <h2>{text.title}</h2>
        <span>{text.subtitle}</span>
      </div>

      {searchParams.get("registered") === "1" && (
        <div className="auth-message success" role="status">
          <CheckCircle2 size={18} />
          <span>{text.successBanner}</span>
        </div>
      )}
      {serverError && (
        <div className="auth-message error" role="alert">
          <AlertCircle size={18} />
          <span>{serverError}</span>
        </div>
      )}

      <label className="auth-field">
        <span>{text.email}</span>
        <span className="auth-input-wrap">
          <Mail size={18} />
          <input
            {...register("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={text.emailPlaceholder}
            aria-invalid={!!errors.email}
          />
        </span>
        {errors.email && <small>{errors.email.message}</small>}
      </label>

      <label className="auth-field">
        <span>{text.password}</span>
        <span className="auth-input-wrap">
          <Lock size={18} />
          <input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={text.passwordPlaceholder}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? text.hide : text.show}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
        {errors.password && <small>{errors.password.message}</small>}
      </label>

      <div className="auth-row-between">
        <label className="auth-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>{text.remember}</span>
        </label>
        {onForgotPassword ? (
          <button type="button" className="auth-link" onClick={onForgotPassword}>
            <KeyRound size={13} />
            <span>{text.forgot}</span>
          </button>
        ) : (
          <Link className="auth-link" href="/forgot-password">
            <KeyRound size={13} />
            <span>{text.forgot}</span>
          </Link>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} className="auth-submit">
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> {text.loading}
          </>
        ) : (
          text.submit
        )}
      </button>

      <p className="auth-security-badge">
        <ShieldCheck size={13} />
        <span>{text.securityBadge}</span>
      </p>

      <p className="auth-switch">
        {text.prompt}{" "}
        {onSwitchMode ? (
          <button type="button" onClick={onSwitchMode}>{text.switch}</button>
        ) : (
          <Link href="/register">{text.switch}</Link>
        )}
      </p>
    </form>
  );
}
