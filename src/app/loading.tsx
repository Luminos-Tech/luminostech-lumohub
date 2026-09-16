import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size={32} />
        <p className="text-sm font-medium text-gray-400 animate-pulse">
          Đang tải...
        </p>
      </div>
    </div>
  );
}
