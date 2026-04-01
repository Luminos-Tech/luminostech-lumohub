import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "LumoHub — Smart Calendar",
  description: "Quản lý lịch thông minh với LumoHub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
