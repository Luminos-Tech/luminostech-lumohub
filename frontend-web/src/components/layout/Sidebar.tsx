"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Calendar, ListChecks, Bell,
  Settings, Users, ScrollText, LogOut, Zap, Smartphone, Activity, Wifi, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",              label: "Tổng quan",    icon: LayoutDashboard },
  { href: "/calendar",               label: "Lịch",          icon: Calendar },
  { href: "/events",                 label: "Sự kiện",       icon: ListChecks },
  { href: "/notifications",          label: "Thông báo",     icon: Bell },
  { href: "/settings",               label: "Cài đặt",       icon: Settings },
  { href: "/settings/devices",       label: "Thiết bị",      icon: Smartphone },
  { href: "/settings/event-buttons", label: "Nhật ký nút",   icon: Activity },
];

const adminItems = [
  { href: "/admin/users",     label: "Người dùng", icon: Users },
  { href: "/admin/logs",      label: "Logs",        icon: ScrollText },
  { href: "/admin/websocket", label: "WebSocket",   icon: Wifi },
];

interface SidebarProps {
  /** Mobile: controlled externally (drawer mode) */
  isOpen?: boolean;
  onClose?: () => void;
}

function NavLink({
  href, label, Icon, active, onClick,
}: { href: string; label: string; Icon: React.ElementType; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-primary-50 text-primary-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const sidebarContent = (
    <aside className="flex flex-col h-full w-60 bg-white py-6 px-3">
      {/* Logo */}
      <div className="flex items-center justify-between px-3 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">LumoHub</span>
        </div>
        {/* Close button — only visible in mobile drawer */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 md:hidden"
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
            onClick={onClose}
          />
        ))}

        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.icon}
                active={pathname.startsWith(item.href)}
                onClick={onClose}
              />
            ))}
          </>
        )}
      </nav>

      {/* User / Logout */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold shrink-0">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => { logout().then(() => (window.location.href = "/login")); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={17} /> Đăng xuất
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex min-h-screen border-r border-gray-200">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer panel */}
          <div className="relative z-10 flex h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
