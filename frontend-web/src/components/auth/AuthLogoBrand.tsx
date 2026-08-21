import Image from "next/image";
import { registerLogoTap } from "@/lib/demoTrigger";

export default function AuthLogoBrand() {
  return (
    <button 
      type="button"
      className="auth-brand cursor-pointer select-none active:opacity-80 transition-opacity bg-transparent border-0 p-0 text-left" 
      aria-label="Lumo - Trang chủ" 
      onPointerDown={(e) => registerLogoTap(e)}
      onClick={(e) => registerLogoTap(e)}
    >
      <span className="auth-brand-mark">
        <Image src="/logo-luminostech.png" alt="LuminosTech" width={47} height={62} priority />
      </span>
      <span><strong>LUMO</strong><small>by LuminosTech</small></span>
    </button>
  );
}
