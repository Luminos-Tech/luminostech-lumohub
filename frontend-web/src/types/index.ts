export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: number;
  event_id: number;
  remind_before_minutes: number;
  channel: "web" | "mobile" | "lumo";
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
}

export interface Event {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "canceled";
  priority: "low" | "normal" | "high";
  color?: string;
  created_at: string;
  updated_at: string;
  reminders: Reminder[];
}

export interface Notification {
  id: number;
  user_id: number;
  event_id?: number;
  title: string;
  content: string;
  channel: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface SystemLog {
  id: number;
  user_id?: number;
  action: string;
  target_type?: string;
  target_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Device {
  id: number;
  user_id: number;
  device_id: string;  // 4-digit code
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
