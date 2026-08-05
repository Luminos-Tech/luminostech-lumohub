"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import BottomNav from "./BottomNav";
import Topbar from "./Topbar";
import Spinner from "@/components/common/Spinner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return router.replace("/login");
    if (!user) fetchMe().catch(() => router.replace("/login"));
  }, [fetchMe, router, user]);

  if (!isAuthenticated || !user) {
    return <div className="app-loading"><Spinner className="h-8 w-8" /><span>Đang kết nối với Lumo...</span></div>;
  }

  return (
    <div className="mobile-app-shell">
      <Topbar />
      <main className="mobile-app-content">{children}</main>
      <BottomNav />
    </div>
  );
}
