"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Image as ImageIcon, Type, X, Upload, CheckSquare, Square, Loader2, AlertCircle, Plus } from "lucide-react";
import { useEventStore } from "@/store/eventStore";
import type { Event } from "@/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ExtractedEvent {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  priority: "low" | "normal" | "high";
  color?: string;
  reminders: [];
}

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

type InputTab = "text" | "image";

export default function AIImportModal({ onClose, onCreated }: Props) {
  const { createEvent } = useEventStore();
  const [tab, setTab] = useState<InputTab>("text");
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (newFiles.length === 0) return;

    setImageFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        setTab("image");
        handleImageChange(e.clipboardData.files);
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [handleImageChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setTab("image");
      handleImageChange(e.dataTransfer.files);
    }
  }, [handleImageChange]);

  const handleExtract = async () => {
    setError(null);
    setExtractedEvents(null);

    if (tab === "text" && !text.trim()) { setError("Vui lòng nhập nội dung"); return; }
    if (tab === "image" && imageFiles.length === 0) { setError("Vui lòng chọn hoặc dán ảnh"); return; }

    setLoading(true);
    try {
      let payload: Record<string, any>;
      if (tab === "image" && imageFiles.length > 0) {
        const imagesData = await Promise.all(
          imageFiles.map(async (file) => ({
            base64: await fileToBase64(file),
            mime_type: file.type
          }))
        );
        payload = { images: imagesData };
      } else {
        payload = { text: text.trim() };
      }

      const { data } = await api.post<{ events: ExtractedEvent[] }>("/events/extract", payload);

      if (!data.events || data.events.length === 0) {
        setError("Không tìm thấy sự kiện nào trong nội dung này");
        return;
      }

      setExtractedEvents(data.events);
      setSelected(new Set(data.events.map((_: ExtractedEvent, i: number) => i)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!extractedEvents || selected.size === 0) return;
    setCreating(true);
    try {
      const toCreate = extractedEvents.filter((_, i) => selected.has(i));
      await Promise.all(
        toCreate.map((ev) =>
          createEvent({
            title: ev.title,
            description: ev.description || "",
            location: ev.location || "",
            start_time: ev.start_time ? new Date(ev.start_time).toISOString() : new Date().toISOString(),
            end_time: ev.end_time ? new Date(ev.end_time).toISOString() : new Date().toISOString(),
            priority: ev.priority || "normal",
            color: ev.color || "#3B82F6",
            reminders: [],
          } as Parameters<typeof createEvent>[0])
        )
      );
      onCreated?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tạo sự kiện thất bại");
    } finally {
      setCreating(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (!extractedEvents) return;
    setSelected(selected.size === extractedEvents.length ? new Set() : new Set(extractedEvents.map((_, i) => i)));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Nhập lịch bằng AI</h2>
              <p className="text-xs text-gray-400">Trích xuất sự kiện từ ảnh hoặc văn bản</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!extractedEvents ? (
            <div className="p-5 space-y-4">
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                {([["text", Type, "Văn bản"], ["image", ImageIcon, "Hình ảnh"]] as const).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key as InputTab)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                      tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Text input */}
              {tab === "text" && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Dán nội dung lịch vào đây... (email, tin nhắn, thông báo...)"
                  className="w-full h-48 px-3 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                />
              )}

              {/* Image input */}
              {tab === "image" && (
                <div
                  onDrop={(e) => { e.preventDefault(); handleImageChange(e.dataTransfer.files); }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl transition-colors cursor-pointer",
                    imagePreviews.length > 0 ? "border-violet-200 p-4 bg-violet-50/30" : "border-gray-300 hover:border-primary-400 p-8"
                  )}
                >
                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {imagePreviews.map((preview, i) => (
                        <div key={i} className="relative aspect-square group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt={`preview-${i}`} className="w-full h-full object-cover rounded-lg shadow-sm border border-gray-200" />
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                              setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-white transition-colors group">
                        <Plus size={24} className="text-gray-400 group-hover:text-primary-500 mb-1 transition-colors" />
                        <span className="text-[10px] text-gray-400 group-hover:text-primary-500 font-medium">Thêm ảnh</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload size={28} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500">Kéo thả ảnh vào đây, <span className="text-primary-600 font-medium">chọn file</span>, hoặc <span className="text-primary-600 font-medium">Ctrl+V</span> (dán ảnh)</p>
                      <p className="text-xs text-gray-400">Hỗ trợ chọn nhiều ảnh JPG, PNG, WEBP...</p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleImageChange(e.target.files); }}
              />

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                onClick={handleExtract}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Đang phân tích...</>
                ) : (
                  <><Sparkles size={16} /> Phân tích bằng AI</>
                )}
              </button>
            </div>
          ) : (
            /* Result panel */
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Tìm thấy <span className="text-primary-600 font-bold">{extractedEvents.length}</span> sự kiện
                </p>
                <button onClick={toggleAll} className="text-xs text-primary-600 hover:text-violet-800 font-medium">
                  {selected.size === extractedEvents.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
              </div>

              <div className="space-y-2">
                {extractedEvents.map((ev, i) => (
                  <div
                    key={i}
                    onClick={() => toggleSelect(i)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      selected.has(i)
                        ? "border-violet-300 bg-violet-50"
                        : "border-gray-200 bg-gray-50 opacity-60"
                    )}
                  >
                    <div className="mt-0.5 shrink-0 text-primary-500">
                      {selected.has(i) ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color || "#3B82F6" }} />
                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                      </div>
                      {ev.start_time && (
                        <p className="text-xs text-gray-500">
                          🕐 {ev.start_time.replace("T", " ").slice(0, 16)} → {ev.end_time?.replace("T", " ").slice(0, 16)}
                        </p>
                      )}
                      {ev.location && <p className="text-xs text-gray-400 truncate">📍 {ev.location}</p>}
                      {ev.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{ev.description}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          {extractedEvents ? (
            <>
              <button
                onClick={() => { setExtractedEvents(null); setError(null); }}
                className="btn-secondary flex-1"
              >
                ← Nhập lại
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || selected.size === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {creating ? "Đang tạo..." : `Tạo ${selected.size} sự kiện`}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn-secondary w-full">Hủy</button>
          )}
        </div>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
