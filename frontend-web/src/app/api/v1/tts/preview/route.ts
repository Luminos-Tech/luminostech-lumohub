import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "vi";
  const voiceId = searchParams.get("voice_id") || "Kore";

  // Kết nối tới Backend Gemini 3.1 Flash TTS
  try {
    const backendBase = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const backendTarget = `${backendBase}/api/v1/lumo/tts-preview?voice_name=${encodeURIComponent(voiceId)}&lang=${encodeURIComponent(lang)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const backendRes = await fetch(backendTarget, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (backendRes.ok && backendRes.headers.get("content-type")?.includes("audio/")) {
      const audioBuffer = await backendRes.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Nếu backend trả lỗi, trả về lỗi chi tiết
    const errorText = await backendRes.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: "Backend TTS failed", detail: errorText },
      { status: backendRes.status }
    );
  } catch (err) {
    console.error("TTS preview error:", err);
    return NextResponse.json(
      { error: "Cannot connect to TTS backend. Please ensure the backend is running." },
      { status: 502 }
    );
  }
}
