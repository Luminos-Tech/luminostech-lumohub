export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-lumo/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <span className="text-white text-2xl font-bold">L</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LumoHub</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý lịch thông minh</p>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );
}
