/**
 * Dashboard-level loading indicator
 * Lightweight inline skeleton instead of full-screen overlay
 * so the sidebar/topbar remain visible and interactive during navigation.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-12 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3 h-3 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
              <div className="h-3 w-1/2 bg-gray-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
