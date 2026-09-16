"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Calendar, ListChecks, Bell,
  Settings, Users, ScrollText, LogOut, Wifi, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/calendar", label: "Lịch", icon: Calendar },
  { href: "/events", label: "Sự kiện", icon: ListChecks },
  { href: "/notifications", label: "Thông báo", icon: Bell },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

const adminItems = [
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/websocket", label: "WebSocket", icon: Wifi },
];

interface SidebarProps {
  /** Mobile: controlled externally (drawer mode) */
  isOpen?: boolean;
  onClose?: () => void;
}

function NavLink({
  href, label, Icon, active, onClick, collapsed
}: { href: string; label: string; Icon: React.ElementType; active: boolean; onClick?: () => void; collapsed?: boolean }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-xl text-sm font-medium transition-all duration-200 group relative",
        collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
        active
          ? "bg-primary-50 text-primary-700 shadow-sm"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
      )}
    >
      <Icon size={18} className={cn("shrink-0", active ? "text-primary-600" : "")} />
      {!collapsed && <span className="truncate">{label}</span>}
      {/* Active indicator dot */}
      {active && !collapsed && (
        <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary-500" />
      )}
    </Link>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const renderSidebarContent = (isMobile: boolean) => {
    const collapsed = !isMobile && isCollapsed;
    
    return (
      <aside className={cn(
        "relative flex flex-col h-full bg-white py-6 transition-all duration-300",
        collapsed ? "w-20 px-2" : "w-60 px-3"
      )}>
        {/* Toggle button on desktop */}
        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-8 flex items-center justify-center w-6 h-6 bg-white border border-gray-200 text-gray-400 rounded-full hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 shadow-sm z-50 transition-all"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        {/* Logo */}
        <div className={cn("flex items-center justify-center", collapsed ? "mb-8 px-2" : "mb-8 px-3")}>
          <Link href="/dashboard" className="flex items-center shrink-0 max-w-full overflow-hidden">
            <Image
              src="/logo_lumohub.png"
              alt="LumoHub Logo"
              width={320}
              height={160}
              unoptimized
              className={cn("object-contain w-full h-auto", collapsed ? "max-h-8" : "max-h-16")}
            />
          </Link>
          {/* Close button — only visible in mobile drawer */}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0"
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              collapsed={collapsed}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              onClick={onClose}
            />
          ))}

          {user?.role === "admin" && (
            <>
              <div className={cn("pt-4 pb-1", collapsed ? "text-center" : "px-3")}>
                {collapsed ? (
                  <div className="w-4 h-px bg-gray-200 mx-auto my-2" />
                ) : (
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.15em]">Admin</p>
                )}
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  collapsed={collapsed}
                  active={pathname.startsWith(item.href)}
                  onClick={onClose}
                />
              ))}
            </>
          )}
        </nav>

        {/* User / Logout */}
        <div className={cn("mt-4 border-t border-gray-100 pt-4", collapsed ? "px-2 flex flex-col gap-2 items-center" : "")}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 border-hidden overflow-hidden">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-gray-400 truncate capitalize">{user?.role}</p>
              </div>
            </div>
          )}
          {collapsed && (
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold shrink-0 mb-2 mt-2 shadow-sm" title={user?.full_name}>
               {user?.full_name?.charAt(0).toUpperCase()}
             </div>
          )}
          <button
            onClick={() => { logout().then(() => (window.location.href = "/login")); }}
            className={cn(
              "flex items-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200 rounded-xl",
              collapsed ? "p-3 justify-center w-full" : "gap-3 w-full px-3 py-2.5 text-sm"
            )}
            title={collapsed ? "Đăng xuất" : undefined}
          >
            <LogOut size={17} className="shrink-0" /> {!collapsed && <span className="truncate">Đăng xuất</span>}
          </button>
        </div>
      </aside>
    );
  };


  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex min-h-screen border-r border-gray-100">
        {renderSidebarContent(false)}
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
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
