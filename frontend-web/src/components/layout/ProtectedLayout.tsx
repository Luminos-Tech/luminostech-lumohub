"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import Spinner from "@/components/common/Spinner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, fetchMe } = useAuthStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!user) {
      fetchMe().catch(() => router.replace("/login"));
    }
  }, [user, fetchMe, router]);

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar: desktop always-visible + mobile drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        {/* pb-16 on mobile to avoid content behind BottomNav */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0 min-h-0">
          {children}
        </main>
        {/* Footer: hidden on mobile to avoid overlapping with BottomNav */}
        <div className="hidden md:block">
          <Footer />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
