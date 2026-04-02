"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Calendar, ListChecks, Bell,
  Settings, Users, ScrollText, LogOut, Zap, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",      label: "Tổng quan",    icon: LayoutDashboard },
  { href: "/calendar",       label: "Lịch",         icon: Calendar },
  { href: "/events",         label: "Sự kiện",      icon: ListChecks },
  { href: "/notifications",  label: "Thông báo",    icon: Bell },
  { href: "/settings",       label: "Cài đặt",      icon: Settings },
  { href: "/settings/devices", label: "Thiết bị", icon: Smartphone },
];

const adminItems = [
  { href: "/admin/users",  label: "Người dùng", icon: Users },
  { href: "/admin/logs",   label: "Logs",        icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-gray-200 py-6 px-3">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">LumoHub</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}>
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}>
                  <item.icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User / Logout */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { logout().then(() => window.location.href = "/login"); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">
          <LogOut size={17} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}
