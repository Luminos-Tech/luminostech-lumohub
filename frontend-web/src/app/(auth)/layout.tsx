import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf6e3] to-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl animate-fade-in">
        {/* Luminos Tech banner */}
        <div className="bg-[#fdf6e3] rounded-t-3xl overflow-hidden border border-b-0 border-[#f0e6cc]">
          <img
            src="/background.jpg"
            alt="Luminos Tech"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Login card */}
        <div className="bg-white rounded-b-3xl shadow-xl border border-t-0 border-gray-100 px-8 sm:px-12 py-8">
          {/* LumoHub logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logo_lumohub.png"
              alt="LumoHub Logo"
              width={200}
              height={90}
              unoptimized
              priority
              className="object-contain h-auto"
            />
          </div>

          {children}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          © 2026 Luminos Tech
        </p>
      </div>
    </div>
  );
}
