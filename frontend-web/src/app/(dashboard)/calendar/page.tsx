import CalendarView from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <div className="p-4 md:p-6 flex flex-col h-full min-h-0">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Lịch của tôi</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản lý và theo dõi lịch trình của bạn</p>
      </div>
      <div className="flex-1 min-h-0">
        <CalendarView />
      </div>
    </div>
  );
}
