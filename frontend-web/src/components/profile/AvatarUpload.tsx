"use client";
import { useAuthStore } from "@/store/authStore";
import { getInitials } from "@/lib/utils";

export default function AvatarUpload() {
  const { user } = useAuthStore();
  return (
    <div className="flex items-center gap-4">
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={user.full_name} className="w-16 h-16 rounded-full object-cover border-2 border-primary-200" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold border-2 border-primary-200">
          {getInitials(user?.full_name || "?")}
        </div>
      )}
      <div>
        <p className="font-medium text-gray-900">{user?.full_name}</p>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <p className="text-xs text-gray-400 capitalize mt-0.5">{user?.role}</p>
      </div>
    </div>
  );
}
