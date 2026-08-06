"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, Lock, Mail, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usePreferenceStore } from "@/store/preferenceStore";

const schema = z.object({
  full_name: z.string().min(2, "Vui lòng nhập họ tên đầy đủ"),
  email: z.string().email("Vui lòng nhập đúng địa chỉ email"),
  password: z.string().min(6, "Mật khẩu cần có ít nhất 6 ký tự"),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, { message: "Mật khẩu xác nhận chưa khớp", path: ["confirm_password"] });
type FormData = z.infer<typeof schema>;

const fields = [
  { name: "full_name" as const, label: "Họ và tên", placeholder: "Nguyễn Văn A", icon: User, type: "text", autoComplete: "name" },
  { name: "email" as const, label: "Email", placeholder: "ban@email.com", icon: Mail, type: "email", autoComplete: "email" },
  { name: "password" as const, label: "Mật khẩu", placeholder: "Tối thiểu 6 ký tự", icon: Lock, type: "password", autoComplete: "new-password" },
  { name: "confirm_password" as const, label: "Xác nhận mật khẩu", placeholder: "Nhập lại mật khẩu", icon: Lock, type: "password", autoComplete: "new-password" },
];

export default function RegisterForm({ onSuccess, onSwitchMode }: { onSuccess?: () => void; onSwitchMode?: () => void }) {
  const { register: registerUser } = useAuthStore();
  const language = usePreferenceStore((state) => state.language);
  const copy = language === "vi"
    ? { title: "Tạo tài khoản", subtitle: "Chỉ mất một phút để kết nối với người thân.", loading: "Đang tạo tài khoản...", submit: "Tạo tài khoản", prompt: "Đã có tài khoản?", switch: "Đăng nhập" }
    : { title: "Create account", subtitle: "It only takes a minute to connect with your family.", loading: "Creating account...", submit: "Create account", prompt: "Already have an account?", switch: "Sign in" };
  const localizedFields = language === "vi" ? fields : fields.map((field) => ({
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await registerUser(data.full_name, data.email, data.password);
      if (onSuccess) onSuccess();
      else router.push("/login?registered=1");
    } catch (error: any) {
      setServerError(error?.response?.data?.detail || "Không thể tạo tài khoản lúc này. Vui lòng thử lại.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      <div className="auth-form-heading">
        <p>Bắt đầu cùng Lumo</p>
        <h2>{copy.title}</h2>
        <span>{copy.subtitle}</span>
      </div>
      {serverError && <div className="auth-message error" role="alert"><AlertCircle size={18} /><span>{serverError}</span></div>}

      {localizedFields.map((field) => (
        <label className="auth-field" key={field.name}>
          <span>{field.label}</span>
          <span className="auth-input-wrap">
            <field.icon size={18} />
            <input {...register(field.name)} type={field.type} autoComplete={field.autoComplete} placeholder={field.placeholder} aria-invalid={!!errors[field.name]} />
          </span>
          {errors[field.name] && <small>{errors[field.name]?.message}</small>}
        </label>
      ))}

      <button type="submit" disabled={isSubmitting} className="auth-submit">
        {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> {copy.loading}</> : copy.submit}
      </button>
      <p className="auth-switch">{copy.prompt} {onSwitchMode ? <button type="button" onClick={onSwitchMode}>{copy.switch}</button> : <Link href="/login">{copy.switch}</Link>}</p>
    </form>
  );
}
