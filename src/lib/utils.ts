import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function priorityColor(priority: string): string {
  if (priority === "high") return "text-red-600 bg-red-50";
  if (priority === "low") return "text-gray-500 bg-gray-100";
  return "text-blue-600 bg-blue-50";
}

/**
 * Parse a date string from the backend as UTC.
 * Backend often returns strings like "2026-04-04T08:25:00" (no timezone marker).
 * Without the 'Z', JS treats them as LOCAL time — wrong!
 * This function appends 'Z' if no timezone info is present so the date is
 * correctly interpreted as UTC and then displayed in the user's local timezone.
 */
export function parseUTC(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // Already has timezone info (Z, +HH:mm, -HH:mm)
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  // No timezone → treat as UTC
  return new Date(dateStr + "Z");
}

/**
 * Convert a UTC ISO string from the API to a value suitable for
 * a <input type="datetime-local"> (which needs local time, no trailing Z).
 */
export function utcIsoToLocal(iso?: string): string {
  if (!iso) return "";
  const d = parseUTC(iso);
  if (isNaN(d.getTime())) return "";
  // Format as "YYYY-MM-DDTHH:mm" in local timezone
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" + pad(d.getMonth() + 1) +
    "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) +
    ":" + pad(d.getMinutes())
  );
}
