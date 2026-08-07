"use client";

import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { usePreferenceStore } from "@/store/preferenceStore";

type AuthMode = "login" | "register";
export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const language = usePreferenceStore((state) => state.language);
  const labels = language === "vi"
    ? { login: "Đăng nhập", register: "Đăng ký" }
    : { login: "Sign in", register: "Create account" };

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
      <section className="auth-modal" role="dialog" aria-modal="true" aria-label={mode === "login" ? labels.login : labels.register} onMouseDown={(event) => event.stopPropagation()}>
        <div className="auth-modal-tabs" role="tablist">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{labels.login}</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>{labels.register}</button>
        </div>
        {mode === "login"
          ? <LoginForm onSuccess={onClose} onSwitchMode={() => setMode("register")} />
          : <RegisterForm onSuccess={() => setMode("login")} onSwitchMode={() => setMode("login")} />}
      </section>
    </div>
  );
}
