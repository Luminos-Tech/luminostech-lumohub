"use client";

import { useEffect, useState } from "react";
import { X, LogIn, UserPlus } from "lucide-react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { usePreferenceStore } from "@/store/preferenceStore";

type AuthMode = "login" | "register";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [forgotOpen, setForgotOpen] = useState(false);
  const language = usePreferenceStore((state) => state.language);
  const isVi = language === "vi";

  const labels = isVi
    ? { login: "Đăng nhập", register: "Đăng ký", welcome: "Chào mừng đến với Lumo" }
    : { login: "Sign in", register: "Create account", welcome: "Welcome to Lumo" };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "login" ? labels.login : labels.register}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label={isVi ? "Đóng" : "Close"}
        >
          <X size={18} />
        </button>

        <div className="auth-modal-tabs" role="tablist" aria-label={labels.welcome}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            <LogIn size={14} />
            <span>{labels.login}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            <UserPlus size={14} />
            <span>{labels.register}</span>
          </button>
        </div>

        {forgotOpen ? (
          <ForgotPasswordPanel
            onClose={() => setForgotOpen(false)}
            onBackToLogin={() => setForgotOpen(false)}
          />
        ) : mode === "login" ? (
          <LoginForm
            onSuccess={onClose}
            onSwitchMode={() => setMode("register")}
            onForgotPassword={() => setForgotOpen(true)}
          />
        ) : (
          <RegisterForm
            onSuccess={() => setMode("login")}
            onSwitchMode={() => setMode("login")}
          />
        )}
      </section>
    </div>
  );
}

function ForgotPasswordPanel({ onBackToLogin }: { onClose: () => void; onBackToLogin: () => void }) {
  const language = usePreferenceStore((state) => state.language);
  const isVi = language === "vi";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // TODO: gọi POST /api/v1/auth/forgot-password khi backend có endpoint
    await new Promise((resolve) => setTimeout(resolve, 700));
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="auth-form">
      <div className="auth-form-heading">
        <p>{isVi ? "Khôi phục mật khẩu" : "Reset password"}</p>
        <h2>{isVi ? "Quên mật khẩu?" : "Forgot password?"}</h2>
        <span>
          {isVi
            ? "Nhập email đã đăng ký. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu an toàn."
            : "Enter the email you used to sign up. We'll send you a secure reset link."}
        </span>
      </div>

      {sent ? (
        <div className="auth-message success" role="status">
          <span>
            {isVi
              ? `Đã gửi hướng dẫn đến ${email}. Vui lòng kiểm tra hộp thư.`
              : `We've sent instructions to ${email}. Please check your inbox.`}
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{isVi ? "Email đã đăng ký" : "Registered email"}</span>
            <span className="auth-input-wrap">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ban@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </span>
          </label>
          <button type="submit" disabled={loading || !email} className="auth-submit">
            {loading ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Gửi liên kết" : "Send reset link")}
          </button>
        </form>
      )}

      <p className="auth-switch">
        {isVi ? "Nhớ mật khẩu rồi?" : "Remembered your password?"}{" "}
        <button type="button" onClick={onBackToLogin}>
          {isVi ? "Quay lại đăng nhập" : "Back to sign in"}
        </button>
      </p>
    </div>
  );
}
