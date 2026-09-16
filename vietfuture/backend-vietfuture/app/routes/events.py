from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Optional, List, Any
from datetime import datetime
import base64
import json
from app.db.session import get_db
from app.schemas.event import EventCreateRequest, EventUpdateRequest, EventResponse
from app.crud.event import (get_event, get_events_by_user, create_event,
                             update_event, delete_event)
from app.crud.log import log_action
from app.services.deps import get_current_active_user
from app.models.user import User
from app.core.config import settings
from pydantic import BaseModel
from google import genai
import google.genai.types as gtypes

router = APIRouter(prefix="/events", tags=["Events"])

EXTRACT_PROMPT = """Bạn là bộ máy trích xuất lịch và tạo event từ nội dung người dùng cung cấp dưới dạng ảnh hoặc text.

Nhiệm vụ:
- Đọc nội dung từ ảnh hoặc text.
- Tự nhận diện đây có phải là thông tin lịch/sự kiện hay không.
- Nếu có, hãy trích xuất thông tin và trả về JSON duy nhất theo đúng format bên dưới.
- Không giải thích, không thêm markdown, không thêm chữ nào ngoài JSON.
- Nếu có nhiều sự kiện thì trả về mảng JSON.

Yêu cầu output (luôn là mảng):
[{"title":"string","description":"string","location":"string","start_time":"YYYY-MM-DDTHH:MM:SS","end_time":"YYYY-MM-DDTHH:MM:SS","priority":"normal","color":"#3B82F6","reminders":[]}]

Quy tắc:
1. Luôn trả về mảng JSON (dù chỉ có 1 sự kiện).
2. Nếu input là ảnh, đọc toàn bộ chữ rồi suy luận thông tin lịch.
3. title: Ngắn gọn, rõ ràng.
4. description: Gộp thông tin quan trọng còn lại (SĐT, giấy tờ, ghi chú).
5. location: Địa điểm nếu có, nếu không thì "".
6. start_time/end_time: ISO YYYY-MM-DDTHH:MM:SS. Nếu không có giờ kết thúc: +2h. Nếu chỉ có ngày: 08:00-10:00.
7. priority: Luôn "normal".
8. color: Luôn "#3B82F6".
9. reminders: Luôn [].
10. Nếu không đủ dữ liệu: trả về [].
11. Chỉ trả về JSON thuần, không markdown, không code block.
12. Nếu nội dung chứa nhiều ngày, nhiều buổi, nhiều khung giờ hoặc nhiều mốc thời gian khác nhau, phải tách thành nhiều event riêng biệt, không được gộp.
13. Nếu một dòng chứa danh sách ngày, ví dụ: "ngày 11 và 12/4/2026", thì phải tạo event cho từng ngày riêng.
14. Nếu bên dưới có các dòng thời gian như "Buổi sáng: 8:00 - 11:00", "Buổi chiều: 14:00 - 16:00", thì mỗi khung giờ phải được áp dụng cho từng ngày liên quan ở phía trên để tạo thành nhiều event.
15. Các dòng mô tả không có thời gian riêng nhưng thuộc cùng một cụm lịch phải được đưa vào description của các event liên quan.
16. Các mốc như "hạn chót", "deadline", "hạn thanh toán", "ngày tập trung", "ngày thi", "ngày học", "ngày họp" đều được xem là event hợp lệ nếu có ngày rõ ràng.
17. Không bỏ sót event chỉ vì nó là hạn chót hoặc thông báo hành chính
18. Nếu một thông báo có event chính và các event phụ, hãy tách toàn bộ event phụ thành các object riêng trong mảng JSON.
19. Không gộp nhiều ngày vào một event duy nhất nếu mỗi ngày có thể tồn tại độc lập trên lịch.
20. Nếu một event chỉ có ngày mà không có giờ, dùng mặc định 08:00:00 đến 10:00:00.
21. Ưu tiên tách tối đa các mốc lịch độc lập thành các event riêng thay vì gộp chung.
22. Nếu trong input có nhiều mốc thời gian, nhiều ngày, nhiều buổi hoặc nhiều hoạt động khác nhau, hãy trả về đầy đủ tất cả event có thể đặt lên lịch, mỗi event là một object riêng trong mảng JSON."""


class ImageData(BaseModel):
    base64: str
    mime_type: str

class ExtractRequest(BaseModel):
    text: Optional[str] = None
    images: Optional[List[ImageData]] = None
    # Keep old fields for backward compatibility during transition
    image_base64: Optional[str] = None
    image_mime_type: Optional[str] = None


@router.get("", response_model=List[EventResponse])
def list_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return get_events_by_user(db, current_user.id, start=start, end=end, skip=skip, limit=limit)


@router.get("/{event_id}", response_model=EventResponse)
def get_one_event(event_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return event


@router.post("", response_model=EventResponse, status_code=201)
def create_new_event(body: EventCreateRequest, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = create_event(
        db,
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        location=body.location,
        start_time=body.start_time,
        end_time=body.end_time,
        priority=body.priority,
        color=body.color,
        reminders_data=body.reminders,
    )
    log_action(db, action="create_event", user_id=current_user.id,
               target_type="event", target_id=event.id,
               ip_address=request.client.host if request.client else None)
    return event


@router.patch("/{event_id}", response_model=EventResponse)
def update_one_event(event_id: int, body: EventUpdateRequest, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = update_event(db, event, **body.model_dump(exclude_none=True))
    log_action(db, action="update_event", user_id=current_user.id, target_type="event", target_id=event.id)
    return updated


@router.delete("/{event_id}", status_code=204)
def delete_one_event(event_id: int, request: Request,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_active_user)):
    event = get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    log_action(db, action="delete_event", user_id=current_user.id, target_type="event", target_id=event.id)
    delete_event(db, event)


@router.post("/extract", tags=["Events"])
async def extract_events_from_content(
    body: ExtractRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Dùng Gemini để trích xuất sự kiện từ text hoặc ảnh (base64)."""
    # Normalize images
    if not body.images and body.image_base64 and body.image_mime_type:
        body.images = [ImageData(base64=body.image_base64, mime_type=body.image_mime_type)]

    if not body.text and not body.images:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp text hoặc ảnh")
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY chưa được cấu hình")

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Build parts list with proper types
        parts_list: list[gtypes.Part] = [
            gtypes.Part.from_text(text=EXTRACT_PROMPT + "\n\nNội dung cần phân tích:\n")
        ]

        if body.images:
            for img in body.images:
                parts_list.append(
                    gtypes.Part.from_bytes(
                        data=base64.b64decode(img.base64),
                        mime_type=img.mime_type
                    )
                )

        if body.text:
            parts_list.append(gtypes.Part.from_text(text=body.text))

        contents = [gtypes.Content(role="user", parts=parts_list)]

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=contents,
            config=gtypes.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )

        raw = response.text or ""
        # Strip markdown code fences if present
        cleaned = raw.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(cleaned)
            events = parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail=f"Gemini trả về dữ liệu không hợp lệ: {raw[:200]}")

        return {"events": events}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

