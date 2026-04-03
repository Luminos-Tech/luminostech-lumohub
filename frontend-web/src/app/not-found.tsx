import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="relative">
        <h1 className="text-9xl font-extrabold text-primary-50 px-4">404</h1>
        <div className="absolute inset-0 flex items-center justify-center translate-y-4">
          <p className="text-xl font-bold text-gray-900">Không tìm thấy trang</p>
        </div>
      </div>
      <p className="mt-8 text-gray-500 max-w-sm">
        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
      </p>
      <div className="mt-10 flex gap-4">
        <Link href="/" className="btn-secondary">
          <ArrowLeft size={18} />
          Quay lại
        </Link>
        <Link href="/" className="btn-primary">
          <Home size={18} />
          Trang chủ
        </Link>
      </div>
    </div>
  );
}
