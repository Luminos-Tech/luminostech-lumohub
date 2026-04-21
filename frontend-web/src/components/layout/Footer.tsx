"use client";
import { Github, Heart } from "lucide-react";
import Image from "next/image";

const links = [
  { label: "Tài liệu", href: "#" },
  { label: "Liên hệ", href: "#" },
  { label: "Chính sách", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <Image
            src="/logo_lumohub.png"
            alt="LumoHub Logo"
            width={170}
            height={60}
            className="object-contain w-auto h-8"
          />
          <span className="text-xs text-gray-300 ml-1">v1.0.0 Beta © 2026</span>
        </div>

        {/* Links — hidden on mobile to keep it clean */}
        <div className="hidden sm:flex items-center gap-5">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href=""
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-1"
          >
            <Github size={12} />
            ...
          </a>
        </div>

        {/* Made with */}
        <p className="text-xs text-gray-300 flex items-center gap-1">
          Made with <Heart size={10} className="text-primary-500 fill-primary-500" /> by Luminos Tech
        </p>
      </div>
    </footer>
  );
}
