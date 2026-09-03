"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usePreferenceStore } from "@/store/preferenceStore";

const schema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ tên đầy đủ"),
  email: z.string().email("Vui lòng nhập đúng địa chỉ email"),
  password: z
    .string()
    .min(6, "Mật khẩu cần có ít nhất 6 ký tự")
    .regex(/[A-Za-z]/, "Mật khẩu nên có ít nhất 1 chữ cái")
    .regex(/[0-9]/, "Mật khẩu nên có ít nhất 1 chữ số"),
  confirm_password: z.string(),
  accept_terms: z.literal(true, { errorMap: () => ({ message: "Vui lòng đồng ý điều khoản để tiếp tục" }) }),
}).refine((data) => data.password === data.confirm_password, {
  message: "Mật khẩu xác nhận chưa khớp",
  path: ["confirm_password"],
});
type FormData = z.infer<typeof schema>;

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function evaluatePassword(pwd: string): PasswordStrength {
  if (!pwd) return { score: 0, label: "—", color: "muted" };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const palette: Record<0 | 1 | 2 | 3 | 4, { label: string; color: string }> = {
    0: { label: "—", color: "muted" },
    1: { label: "Yếu", color: "weak" },
    2: { label: "Trung bình", color: "fair" },
    3: { label: "Tốt", color: "good" },
    4: { label: "Mạnh", color: "strong" },
  };
  return { score: clamped, ...palette[clamped] };
}

const baseFields = [
  { name: "full_name" as const, label: "Họ và tên", placeholder: "Nguyễn Văn A", icon: User, type: "text", autoComplete: "name" },
  { name: "email" as const, label: "Email", placeholder: "ban@email.com", icon: Mail, type: "email", autoComplete: "email" },
  { name: "password" as const, label: "Mật khẩu", placeholder: "Tối thiểu 6 ký tự", icon: Lock, type: "password", autoComplete: "new-password" },
  { name: "confirm_password" as const, label: "Xác nhận mật khẩu", placeholder: "Nhập lại mật khẩu", icon: Lock, type: "password", autoComplete: "new-password" },
];

export default function RegisterForm({ onSuccess, onSwitchMode }: {
  onSuccess?: () => void;
  onSwitchMode?: () => void;
}) {
  const { register: registerUser } = useAuthStore();
  const language = usePreferenceStore((state) => state.language);
  const copy = language === "vi"
    ? {
        title: "Tạo tài khoản",
        subtitle: "Chỉ mất một phút để kết nối với người thân.",
        loading: "Đang tạo tài khoản...",
        submit: "Tạo tài khoản",
        prompt: "Đã có tài khoản?",
        switch: "Đăng nhập",
        strengthLabel: "Độ mạnh mật khẩu",
        termsPrefix: "Tôi đồng ý với",
        termsLink: "Điều khoản dịch vụ",
        termsAnd: "và",
        privacyLink: "Chính sách bảo mật",
        securityBadge: "Dữ liệu của gia đình được bảo vệ riêng tư",
        genericError: "Không thể tạo tài khoản lúc này. Vui lòng thử lại.",
      }
    : {
        title: "Create account",
        subtitle: "It only takes a minute to connect with your family.",
        loading: "Creating account...",
        submit: "Create account",
        prompt: "Already have an account?",
        switch: "Sign in",
        strengthLabel: "Password strength",
        termsPrefix: "I agree to the",
        termsLink: "Terms of Service",
        termsAnd: "and",
        privacyLink: "Privacy Policy",
        securityBadge: "Your family data is kept private",
        genericError: "Cannot create your account right now. Please try again.",
      };

  const localizedFields = language === "vi"
    ? baseFields
    : baseFields.map((field) => ({
        ...field,
        label: {
          full_name: "Full name",
          email: "Email",
          password: "Password",
          confirm_password: "Confirm password",
        }[field.name],
        placeholder: {
          full_name: "Your full name",
          email: "you@email.com",
          password: "At least 6 characters",
          confirm_password: "Enter password again",
        }[field.name],
      }));

  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), mode: "onTouched" });

  const passwordValue = watch("password") ?? "";
  const strength = useMemo(() => evaluatePassword(passwordValue), [passwordValue]);

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await registerUser(data.full_name, data.email, data.password);
      if (onSuccess) onSuccess();
      else router.push("/login?registered=1");
    } catch (error: any) {
      setServerError(error?.response?.data?.detail || copy.genericError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      <div className="auth-form-heading">
        <p>{language === "vi" ? "Bắt đầu cùng Lumo" : "Get started with Lumo"}</p>
        <h2>{copy.title}</h2>
        <span>{copy.subtitle}</span>
      </div>

      {serverError && (
        <div className="auth-message error" role="alert">
          <AlertCircle size={18} />
          <span>{serverError}</span>
        </div>
      )}

      {localizedFields.map((field) => {
        const isPassword = field.name === "password";
        const isConfirm = field.name === "confirm_password";
        const isVisible = isPassword ? showPassword : isConfirm ? showConfirm : true;
        const toggleVisibility = () => {
          if (isPassword) setShowPassword((v) => !v);
          else if (isConfirm) setShowConfirm((v) => !v);
        };
        return (
          <label className="auth-field" key={field.name}>
            <span>{field.label}</span>
            <span className="auth-input-wrap">
              <field.icon size={18} />
              <input
                {...register(field.name)}
                type={isPassword || isConfirm ? (isVisible ? "text" : "password") : field.type}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                aria-invalid={!!errors[field.name]}
              />
              {(isPassword || isConfirm) && (
                <button
                  type="button"
                  onClick={toggleVisibility}
                  aria-label={isVisible
                    ? (language === "vi" ? "Ẩn mật khẩu" : "Hide password")
                    : (language === "vi" ? "Hiện mật khẩu" : "Show password")}
                >
                  {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              )}
            </span>
            {errors[field.name] && <small>{errors[field.name]?.message as string}</small>}
            {isPassword && (
              <div className={`auth-strength auth-strength--${strength.color}`} aria-live="polite">
                <div className="auth-strength-track">
                  <span style={{ width: `${(strength.score / 4) * 100}%` }} />
                </div>
                <small>{copy.strengthLabel}: <strong>{strength.label}</strong></small>
              </div>
            )}
          </label>
        );
      })}

      <label className="auth-terms">
        <input type="checkbox" {...register("accept_terms")} />
        <span>
          {copy.termsPrefix}{" "}
          <Link href="/terms" target="_blank">{copy.termsLink}</Link>{" "}
          {copy.termsAnd}{" "}
          <Link href="/privacy" target="_blank">{copy.privacyLink}</Link>.
        </span>
      </label>
      {errors.accept_terms && <small className="auth-terms-error">{errors.accept_terms.message as string}</small>}

      <button type="submit" disabled={isSubmitting} className="auth-submit">
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> {copy.loading}
          </>
        ) : (
          copy.submit
        )}
      </button>

      <p className="auth-security-badge">
        <ShieldCheck size={13} />
        <span>{copy.securityBadge}</span>
      </p>

      <p className="auth-switch">
        {copy.prompt}{" "}
        {onSwitchMode ? (
          <button type="button" onClick={onSwitchMode}>{copy.switch}</button>
        ) : (
          <Link href="/login">{copy.switch}</Link>
        )}
      </p>
    </form>
  );
}
