'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log error to console for easier debugging
    console.error('Frontend Error:', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Đã có lỗi xảy ra!</h2>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Rất tiếc, đã có sự cố ngoài ý muốn. Bạn có thể thử tải lại hoặc liên hệ hỗ trợ nếu vấn đề vẫn tiếp diễn.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary"
        >
          Làm mới trang
        </button>
        <button
          onClick={() => reset()}
          className="btn-primary"
        >
          <RefreshCw size={18} />
          Thử lại
        </button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 text-left max-w-2xl bg-gray-50 p-4 rounded-lg overflow-auto border">
          <p className="text-xs font-mono text-red-500">{error.message}</p>
          <pre className="text-[10px] mt-2 text-gray-400">
            {error.stack}
          </pre>
        </div>
      )}
    </div>
  );
}
