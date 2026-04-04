import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-lumo/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/logo_lumohub.png"
            alt="LumoHub Logo"
            width={220}
            height={220}
            className="mx-auto mb-4 object-contain shadow-sm rounded-2xl bg-white"
          />
          <p className="text-gray-500 text-sm mt-1">Quản lý lịch thông minh</p>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );
}
