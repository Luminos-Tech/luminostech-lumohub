import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LumoHub — Smart Calendar",
  description: "Quản lý lịch thông minh với LumoHub",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
