import Link from "next/link";
import { Users, ScrollText, Bell } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Quản trị hệ thống</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/users" className="card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
          <Users size={32} className="text-primary-600" />
          <span className="font-medium text-gray-800">Quản lý người dùng</span>
        </Link>
        <Link href="/admin/logs" className="card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
          <ScrollText size={32} className="text-indigo-600" />
          <span className="font-medium text-gray-800">Log hệ thống</span>
        </Link>
        <Link href="/admin/push" className="card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow">
          <Bell size={32} className="text-purple-600" />
          <span className="font-medium text-gray-800">Gửi Push</span>
        </Link>
      </div>
    </div>
  );
}
