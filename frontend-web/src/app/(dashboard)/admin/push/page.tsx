"use client";
import { useEffect, useState } from "react";
import { Bell, Send, Users, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { adminApi } from "@/features/admin/api";
import { toast } from "sonner";

interface PushStatus {
  total_subscriptions: number;
  users_with_push: number;
}

interface UserOption {
  id: number;
  full_name: string;
  email: string;
}

export default function AdminPushPage() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number; target: string } | null>(null);

  useEffect(() => {
    // 加载订阅状态
    adminApi.getPushStatus().then(({ data }) => setStatus(data)).catch(() => {});
    // 加载用户列表
    adminApi.users().then(({ data }) => setUsers(
      data.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }))
    )).catch(() => {});
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Nhập đủ tiêu đề và nội dung");
      return;
    }
    if (targetType === "specific" && !selectedUser) {
      toast.error("Chọn người dùng");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data } = await adminApi.sendPushNotification({
        user_id: targetType === "specific" ? selectedUser : null,
        title: title.trim(),
        body: body.trim(),
        tag: "lumohub-admin",
      });
      setResult(data);
      toast.success(`Đã gửi ${data.sent}/${data.total} thông báo`);
    } catch {
      toast.error("Gửi thất bại");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
              <Bell size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Gửi Push Notification</h1>
              <p className="text-xs text-gray-400">Thông báo đẩy đến trình duyệt người dùng</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 订阅统计卡片 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Users size={15} className="text-primary-500" />
            Tình trạng Push Subscription
          </h2>
          {status ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary-600">{status.total_subscriptions}</p>
                <p className="text-xs text-primary-500 mt-1">Tổng subscription</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{status.users_with_push}</p>
                <p className="text-xs text-green-500 mt-1">Người dùng đã bật</p>
              </div>
            </div>
          ) : (
            <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">
            Người dùng cần bật thông báo trên trình duyệt để nhận Push Notification
          </p>
        </div>

        {/* 发送表单 */}
        <form onSubmit={handleSend} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Send size={15} className="text-primary-500" />
            Soạn thông báo
          </h2>

          {/* 目标选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Gửi đến</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setTargetType("all"); setSelectedUser(null); }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                  targetType === "all"
                    ? "bg-primary-50 border-primary-200 text-primary-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Users size={14} className="inline mr-1.5" />
                Tất cả người dùng
              </button>
              <button
                type="button"
                onClick={() => setTargetType("specific")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                  targetType === "specific"
                    ? "bg-primary-50 border-primary-200 text-primary-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Bell size={14} className="inline mr-1.5" />
                Người dùng cụ thể
              </button>
            </div>
          </div>

          {/* 用户下拉 */}
          {targetType === "specific" && (
            <div className="relative">
              <select
                value={selectedUser ?? ""}
                onChange={(e) => setSelectedUser(Number(e.target.value) || null)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
              >
                <option value="">-- Chọn người dùng --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* 标题 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="VD: Nhắc lịch học"
              maxLength={100}
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nội dung</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={4}
              placeholder="VD: Bạn có lịch học Toán vào 14:00 hôm nay"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/500</p>
          </div>

          {/* 发送按钮 */}
          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Send size={15} />
            {sending ? "Đang gửi..." : "Gửi Push Notification"}
          </button>

          {/* 结果反馈 */}
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              result.sent > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {result.sent > 0 ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <XCircle size={16} className="shrink-0" />
              )}
              <span>
                Đã gửi {result.sent}/{result.total} thông báo đến {result.target}
              </span>
            </div>
          )}
        </form>

        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">Lưu ý</h3>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• Push Notification chỉ gửi được khi người dùng đã bật thông báo trên trình duyệt</li>
            <li>• Thông báo sẽ hiển thị ngay cả khi người dùng không mở ứng dụng</li>
            <li>• Nếu backend chưa có VAPID_KEY, Push Notification sẽ không hoạt động</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
