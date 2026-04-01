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
