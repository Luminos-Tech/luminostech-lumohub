import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (full_name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      login: async (email, password) => {
        const res = await api.post("/auth/login", { email, password });
        const { access_token, refresh_token } = res.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        const me = await api.get("/auth/me");
        set({ user: me.data, isAuthenticated: true });
      },

      register: async (full_name, email, password) => {
        await api.post("/auth/register", { full_name, email, password });
      },

      logout: async () => {
        const refresh_token = localStorage.getItem("refresh_token");
        if (refresh_token) {
          try { await api.post("/auth/logout", { refresh_token }); } catch {}
        }
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        const res = await api.get("/auth/me");
        set({ user: res.data, isAuthenticated: true });
      },
    }),
    { name: "lumohub-auth", partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
