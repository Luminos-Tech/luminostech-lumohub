import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

export function LoadingSpinner({ className, size = 24, label }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 
        className="animate-spin text-primary-600" 
        size={size} 
      />
      {label && <p className="text-sm text-gray-500 font-medium">{label}</p>}
    </div>
  );
}
