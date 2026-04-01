import { cn } from "@/lib/utils";

// ─── Spinner ──────────────────────────────────────────────────────────────────
export default function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin h-6 w-6 text-primary-500", className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color?: "blue" | "green" | "red" | "gray" | "purple"; }
export function Badge({ label, color = "blue" }: BadgeProps) {
  const colors = {
    blue:   "bg-blue-100 text-blue-700",
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    gray:   "bg-gray-100 text-gray-600",
    purple: "bg-indigo-100 text-indigo-700",
  };
  return <span className={cn("badge", colors[color])}>{label}</span>;
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; }
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <p className="font-medium text-gray-600">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
