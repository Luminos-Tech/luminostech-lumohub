import CalendarView from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Lịch của tôi</h1>
      </div>
      <CalendarView />
    </div>
  );
}
