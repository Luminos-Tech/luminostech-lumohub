import { api } from "@/lib/api";
import type { Notification } from "@/types";

export const notificationsApi = {
  list: (params?: { skip?: number; limit?: number }) =>
    api.get<Notification[]>("/notifications", { params }),

  markRead: (id: number) =>
    api.patch<Notification>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch<{ marked_read: number }>("/notifications/read-all"),
};
