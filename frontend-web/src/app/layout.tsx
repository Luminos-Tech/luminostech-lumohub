import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import PreferenceSync from "@/components/PreferenceSync";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumo - An tâm mỗi ngày",
  description: "Theo dõi điểm danh, thiết bị và lịch nhắc của gia đình cùng Lumo.",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Lumo - An tâm mỗi ngày",
    description: "Theo dõi điểm danh, thiết bị và lịch nhắc của gia đình cùng Lumo.",
    type: "website",
    siteName: "Lumo Hub",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f2fafa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* PWA iOS meta tags — phải để trong <head> */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lumo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#00afa8" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        <PreferenceSync />
        <ServiceWorkerRegistration />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
