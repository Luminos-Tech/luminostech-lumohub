"use client";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { useDemoStore } from "@/store/demoStore";
import { getInitials } from "@/lib/utils";

export default function AvatarUpload() {
  const { user } = useAuthStore();
  const { isDemoMode, mockUser } = useDemoStore();
  const activeUser = user || (isDemoMode ? mockUser : null);

  return (
    <div className="flex items-center gap-4">
      {activeUser?.avatar_url ? (
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary-200">
          <Image src={activeUser.avatar_url} alt={activeUser.full_name || "Avatar"} fill className="object-cover" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold border-2 border-primary-200">
          {getInitials(activeUser?.full_name || "M")}
        </div>
      )}
      <div>
        <p className="font-medium text-gray-900">{activeUser?.full_name || "LUMO User"}</p>
        <p className="text-sm text-gray-500">{activeUser?.email || "user@lumohub.vn"}</p>
        <p className="text-xs text-gray-400 capitalize mt-0.5">{activeUser?.role || "user"}</p>
      </div>
    </div>
  );
}

