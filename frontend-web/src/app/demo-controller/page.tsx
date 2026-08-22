"use client";

import DemoControlDrawer from "@/demo/components/DemoControlDrawer";

export default function DemoControllerPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col items-center justify-start text-center overflow-y-auto">
      {/* Background patterns */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0 pointer-events-none" />
      
      <div className="z-10 w-full max-w-2xl mx-auto flex flex-col gap-6 mt-4">
        <div>
          <h1 className="text-white text-3xl font-bold mb-2">LUMO Presenter Suite</h1>
          <p className="text-slate-400 text-sm">
            Màn hình điều khiển độc lập. Bấm nút tại đây sẽ đồng bộ lập tức sang màn chiếu.
          </p>
        </div>

        {/* Inline DemoControlDrawer without Fixed Overlay */}
        <DemoControlDrawer inline={true} />
      </div>
    </div>
  );
}
