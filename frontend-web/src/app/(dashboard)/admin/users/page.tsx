"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";
import { format } from "date-fns";
import { Lock, Unlock, ShieldCheck, KeyRound, UserPlus } from "lucide-react";
import RoleBadge from "@/components/admin/RoleBadge";
import CreateUserModal from "@/components/admin/CreateUserModal";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; email: string } | null>(null);

  const load = () =>
    api.get<User[]>("/admin/users").then((r) => setUsers(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const lockUser = async (id: number) => { await api.patch(`/admin/users/${id}/lock`); load(); };
  const unlockUser = async (id: number) => { await api.patch(`/admin/users/${id}/unlock`); load(); };
  const toggleRole = async (id: number, current: string) => {
    await api.patch(`/admin/users/${id}/role`, { role: current === "admin" ? "user" : "admin" });
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quản lý người dùng</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <UserPlus size={16} />
          Tạo tài khoản
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Đang tải...</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["ID", "Họ tên", "Email", "Vai trò", "Trạng thái", "Ngày tạo", "Hành động"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.is_active ? "Hoạt động" : "Bị khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(u.created_at), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        title={u.is_active ? "Khóa" : "Mở khóa"}
                        onClick={() => u.is_active ? lockUser(u.id) : unlockUser(u.id)}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 ${u.is_active ? "text-red-500" : "text-green-600"}`}
                      >
                        {u.is_active ? <Lock size={15} /> : <Unlock size={15} />}
                      </button>
                      <button
                        title="Đổi vai trò"
                        onClick={() => toggleRole(u.id, u.role)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-primary-500"
                      >
                        <ShieldCheck size={15} />
                      </button>
                      <button
                        title="Đổi mật khẩu"
                        onClick={() => setResetTarget({ id: u.id, email: u.email })}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-amber-500"
                      >
                        <KeyRound size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {resetTarget && (
        <ResetPasswordModal
          userId={resetTarget.id}
          userEmail={resetTarget.email}
          onClose={() => setResetTarget(null)}
          onDone={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
