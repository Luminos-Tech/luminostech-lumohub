import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Bạn là bộ máy trích xuất lịch và tạo event từ nội dung người dùng cung cấp dưới dạng ảnh hoặc text.

Nhiệm vụ:
- Đọc nội dung từ ảnh hoặc text.
- Tự nhận diện đây có phải là thông tin lịch/sự kiện hay không.
- Nếu có, hãy trích xuất thông tin và trả về JSON duy nhất theo đúng format bên dưới.
- Không giải thích, không thêm markdown, không thêm chữ nào ngoài JSON.
- Nếu có nhiều sự kiện thì trả về mảng JSON.

Yêu cầu output (mảng):
[
  {
    "title": "string",
    "description": "string",
    "location": "string",
    "start_time": "YYYY-MM-DDTHH:MM:SS",
    "end_time": "YYYY-MM-DDTHH:MM:SS",
    "priority": "normal",
    "color": "#3B82F6",
    "reminders": []
  }
]

Quy tắc xử lý:
1. Luôn trả về mảng JSON (dù chỉ có 1 sự kiện).
2. Nếu input là ảnh, hãy đọc toàn bộ chữ trong ảnh rồi suy luận thông tin lịch.
3. title: Ngắn gọn, rõ ràng.
4. description: Gộp các thông tin quan trọng còn lại (SĐT, giấy tờ, ghi chú).
5. location: Điền đúng địa điểm nếu có, nếu không thì "".
6. start_time và end_time: Format ISO YYYY-MM-DDTHH:MM:SS. Nếu không có giờ kết thúc: end_time = start_time + 2 tiếng. Nếu chỉ có ngày: start_time = 08:00:00, end_time = 10:00:00.
7. priority: Luôn "normal".
8. color: Luôn "#3B82F6".
9. reminders: Luôn [].
10. Nếu nội dung không đủ để tạo event: trả về mảng rỗng [].
11. Chỉ trả về JSON thuần, không markdown, không code block.`;

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY chưa được cấu hình" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { text, imageBase64, imageMimeType } = body as {
      text?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!text && !imageBase64) {
      return NextResponse.json({ error: "Vui lòng cung cấp text hoặc ảnh" }, { status: 400 });
    }

    // Build Gemini parts
    const parts: object[] = [{ text: SYSTEM_PROMPT + "\n\nNội dung cần phân tích:\n" }];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64,
        },
      });
    }

    if (text) {
      parts.push({ text });
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return NextResponse.json({ error: `Gemini API lỗi: ${err}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip markdown code blocks if present
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let events: object[];
    try {
      const parsed = JSON.parse(cleaned);
      events = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return NextResponse.json({ error: "Gemini trả về dữ liệu không hợp lệ", raw: rawText }, { status: 422 });
    }

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
