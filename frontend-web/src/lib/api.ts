import axios from "axios";
import { toast } from "sonner";

/** Same-origin proxy via next.config.js rewrites → avoids calling localhost from the browser in production. */
const BASE_URL = "/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401 & Global Error Handling
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Handle 401 Unauthorized (Token expired)
    if (status === 401 && !original._retry) {
      original._retry = true;
      const refresh_token = localStorage.getItem("refresh_token");
      if (refresh_token) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token });
          const { access_token, refresh_token: new_rt } = res.data;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", new_rt);
          original.headers.Authorization = `Bearer ${access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    // Global stability: Toast for 500 errors or Network errors
    if (typeof window !== "undefined") {
      if (!error.response) {
        toast.error("Lỗi kết nối. Vui lòng kiểm tra internet.");
      } else if (status >= 500) {
        toast.error("Lỗi máy chủ. Vui lòng thử lại sau.");
      }
    }

    return Promise.reject(error);
  }
);
