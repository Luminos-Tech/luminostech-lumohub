import { api } from "@/lib/api";
import type { TokenResponse, User } from "@/types";

export const authApi = {
  register: (data: { full_name: string; email: string; password: string }) =>
    api.post<User>("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", data),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>("/auth/refresh", { refresh_token }),

  logout: (refresh_token: string) =>
    api.post("/auth/logout", { refresh_token }),

  me: () => api.get<User>("/auth/me"),
};
