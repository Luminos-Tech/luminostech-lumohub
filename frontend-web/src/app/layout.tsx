import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumo Hub",
  description: "Quản lý lịch thông minh với LumoHub",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Lumo Hub",
    description: "Quản lý lịch thông minh với LumoHub",
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
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* PWA iOS meta tags — phải để trong <head> */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lumo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
