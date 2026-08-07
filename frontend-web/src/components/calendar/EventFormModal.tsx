"use client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEventStore } from "@/store/eventStore";
import Modal from "@/components/common/Modal";
import type { Event } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { utcIsoToLocal } from "@/lib/utils";
import { usePreferenceStore } from "@/store/preferenceStore";

const schema = z.object({
  title: z.string().min(1, "Tiêu đề không được trống"),
  description: z.string().optional(),
  location: z.string().optional(),
  start_time: z.string().min(1, "Vui lòng chọn thời gian bắt đầu"),
  end_time: z.string().min(1, "Vui lòng chọn thời gian kết thúc"),
  priority: z.enum(["low", "normal", "high"]),
  color: z.string(),
  reminders: z.array(z.object({
    remind_before_minutes: z.coerce.number().min(1),
    channel: z.enum(["web", "mobile", "lumo"]),
  })),
});
type FormData = z.infer<typeof schema>;

interface Props {
  event?: Event | null;          // existing event to EDIT
  prefillFrom?: Event | null;    // source event to DUPLICATE (creates new)
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
}


export default function EventFormModal({ event, prefillFrom, defaultStart, defaultEnd, onClose }: Props) {
  const { createEvent, updateEvent } = useEventStore();
  const isEdit = !!event; // prefillFrom = duplicate (still isCreate)
  const en = usePreferenceStore((state) => state.language === "en");
  const t = en ? { edit: "Edit event", create: "Create event", title: "Title", eventName: "Event name", start: "Start", end: "End", location: "Location", locationHint: "Event location", description: "Description", descriptionHint: "Event details...", priority: "Priority", low: "Low", normal: "Normal", high: "High", color: "Color", reminders: "Reminders", addReminder: "Add reminder", minutesBefore: "minutes before ·", voice: "LUMO (voice)", cancel: "Cancel", saving: "Saving...", update: "Update", submit: "Create event" } : { edit: "Chỉnh sửa sự kiện", create: "Tạo sự kiện mới", title: "Tiêu đề", eventName: "Tên sự kiện", start: "Bắt đầu", end: "Kết thúc", location: "Địa điểm", locationHint: "Địa điểm sự kiện", description: "Mô tả", descriptionHint: "Mô tả chi tiết...", priority: "Độ ưu tiên", low: "Thấp", normal: "Bình thường", high: "Cao", color: "Màu sắc", reminders: "Nhắc lịch", addReminder: "Thêm nhắc", minutesBefore: "phút trước ·", voice: "LUMO (giọng nói)", cancel: "Hủy", saving: "Đang lưu...", update: "Cập nhật", submit: "Tạo sự kiện" };

  // Source for pre-filling: edit > duplicate > empty
  const src = event ?? prefillFrom ?? null;

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: prefillFrom ? `${prefillFrom.title} (${en ? "copy" : "bản sao"})` : (event?.title || ""),
      description: src?.description || "",
      location: src?.location || "",
      start_time: utcIsoToLocal(src?.start_time) || (defaultStart ? utcIsoToLocal(defaultStart) || defaultStart.slice(0, 16) : ""),
      end_time: utcIsoToLocal(src?.end_time) || (defaultEnd ? utcIsoToLocal(defaultEnd) || defaultEnd.slice(0, 16) : ""),
      priority: src?.priority || "normal",
      color: src?.color || "#3b82f6",
      reminders: event?.reminders?.map((r) => ({ remind_before_minutes: r.remind_before_minutes, channel: r.channel as "web" | "mobile" | "lumo" })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "reminders" });

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      start_time: new Date(data.start_time).toISOString(),
      end_time: new Date(data.end_time).toISOString(),
    };
    if (isEdit) await updateEvent(event!.id, payload as Partial<Event>);
    else await createEvent(payload as Parameters<typeof createEvent>[0]);
    onClose();
  };

  return (
    <Modal open title={isEdit ? t.edit : t.create} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.title} *</label>
          <input {...register("title")} className="input-field" placeholder={t.eventName} />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.start} *</label>
            <input {...register("start_time")} type="datetime-local" className="input-field" />
            {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.end} *</label>
            <input {...register("end_time")} type="datetime-local" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.location}</label>
          <input {...register("location")} className="input-field" placeholder={t.locationHint} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
          <textarea {...register("description")} className="input-field resize-none h-20" placeholder={t.descriptionHint} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.priority}</label>
            <select {...register("priority")} className="input-field">
              <option value="low">{t.low}</option><option value="normal">{t.normal}</option><option value="high">{t.high}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.color}</label>
            <input {...register("color")} type="color" className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer p-1" />
          </div>
        </div>

        {/* Reminders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">{t.reminders}</label>
            <button type="button" onClick={() => append({ remind_before_minutes: 15, channel: "web" })}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <Plus size={13} /> {t.addReminder}
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  {...register(`reminders.${index}.remind_before_minutes`)}
                  type="number" min={1}
                  className="input-field w-24"
                  placeholder="15"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">{t.minutesBefore}</span>
                <select {...register(`reminders.${index}.channel`)} className="input-field flex-1">
                  <option value="web">Web</option>
                  <option value="mobile">Mobile</option>
                  <option value="lumo">{t.voice}</option>
                </select>
                <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t.cancel}</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? t.saving : isEdit ? t.update : t.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
