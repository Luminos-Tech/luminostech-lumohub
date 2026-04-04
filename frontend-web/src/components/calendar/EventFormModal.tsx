"use client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEventStore } from "@/store/eventStore";
import Modal from "@/components/common/Modal";
import type { Event } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { utcIsoToLocal } from "@/lib/utils";

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
  event?: Event | null;
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
}


export default function EventFormModal({ event, defaultStart, defaultEnd, onClose }: Props) {
  const { createEvent, updateEvent } = useEventStore();
  const isEdit = !!event;

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      location: event?.location || "",
      start_time: utcIsoToLocal(event?.start_time) || (defaultStart ? utcIsoToLocal(defaultStart) || defaultStart.slice(0, 16) : ""),
      end_time: utcIsoToLocal(event?.end_time) || (defaultEnd ? utcIsoToLocal(defaultEnd) || defaultEnd.slice(0, 16) : ""),
      priority: event?.priority || "normal",
      color: event?.color || "#3b82f6",
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
    <Modal open title={isEdit ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
          <input {...register("title")} className="input-field" placeholder="Tên sự kiện" />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu *</label>
            <input {...register("start_time")} type="datetime-local" className="input-field" />
            {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kết thúc *</label>
            <input {...register("end_time")} type="datetime-local" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm</label>
          <input {...register("location")} className="input-field" placeholder="Địa điểm sự kiện" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
          <textarea {...register("description")} className="input-field resize-none h-20" placeholder="Mô tả chi tiết..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
            <select {...register("priority")} className="input-field">
              <option value="low">Thấp</option>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Màu sắc</label>
            <input {...register("color")} type="color" className="h-10 w-full rounded-lg border border-gray-300 cursor-pointer p-1" />
          </div>
        </div>

        {/* Reminders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Nhắc lịch</label>
            <button type="button" onClick={() => append({ remind_before_minutes: 15, channel: "web" })}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <Plus size={13} /> Thêm nhắc
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
                <span className="text-sm text-gray-500 whitespace-nowrap">phút trước ·</span>
                <select {...register(`reminders.${index}.channel`)} className="input-field flex-1">
                  <option value="web">Web</option>
                  <option value="mobile">Mobile</option>
                  <option value="lumo">LUMO (giọng nói)</option>
                </select>
                <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo sự kiện"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
