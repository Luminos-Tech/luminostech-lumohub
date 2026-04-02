"use client";
import { Zap, Github, Heart } from "lucide-react";

const links = [
  { label: "Tài liệu", href: "#" },
  { label: "Liên hệ", href: "#" },
  { label: "Chính sách", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-700">LumoHub</span>
          <span className="text-xs text-gray-400 ml-1">© 2026</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-5">
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
            href="https://github.com/Luminos-Tech/luminostech-lumohub"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-1"
          >
            <Github size={12} />
            GitHub
          </a>
        </div>

        {/* Made with */}
        <p className="text-xs text-gray-300 flex items-center gap-1">
          Made with <Heart size={10} className="text-red-400 fill-red-400" /> by Luminos Tech
        </p>
      </div>
    </footer>
  );
}
