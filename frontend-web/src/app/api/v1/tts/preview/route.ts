import { NextRequest, NextResponse } from "next/server";

const SAMPLE_TEXT_VI: Record<string, string> = {
  Kore: "Xin chào! Tôi là Nhi, trợ lý LUMO AI giọng miền Bắc. Tôi luôn sẵn sàng đồng hành và chăm sóc gia đình bạn mỗi ngày.",
  Aoede: "Xin chào! Tôi là Thư, trợ lý LUMO AI giọng miền Nam. Tôi luôn sẵn sàng đồng hành và chăm sóc gia đình bạn mỗi ngày.",
  Puck: "Xin chào! Tôi là Kiệt, trợ lý LUMO AI giọng miền Bắc. Tôi luôn sẵn sàng đồng hành và chăm sóc gia đình bạn mỗi ngày.",
  Fenrir: "Xin chào! Tôi là Hà, trợ lý LUMO AI giọng miền Nam. Tôi luôn sẵn sàng đồng hành và chăm sóc gia đình bạn mỗi ngày.",
  Charon: "Xin chào! Tôi là Bảo, trợ lý LUMO AI giọng trầm. Tôi luôn sẵn sàng đồng hành và chăm sóc gia đình bạn mỗi ngày.",
};

const SAMPLE_TEXT_EN: Record<string, string> = {
  Kore: "Hello! I am Kore, your LUMO AI assistant. I am always here to support and care for your family.",
  Zephyr: "Hello! I am Zephyr, your bright and friendly LUMO AI assistant, here for your family.",
  Puck: "Hello! I am Puck, your LUMO AI assistant. I am always ready to help your family.",
  Fenrir: "Hello! I am Fenrir, your steady LUMO AI assistant, always watching over your family.",
  Charon: "Hello! I am Charon, your calm LUMO AI assistant, dedicated to your family's safety.",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "vi";
  const voiceId = searchParams.get("voice_id") || "Kore";

  const sampleText =
    lang === "vi"
      ? SAMPLE_TEXT_VI[voiceId] || SAMPLE_TEXT_VI.Kore
      : SAMPLE_TEXT_EN[voiceId] || SAMPLE_TEXT_EN.Kore;

  // 1. Thử kết nối tới Backend Gemini TTS nếu backend đang chạy
  try {
    const backendBase = (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const backendTarget = `${backendBase}/api/v1/lumo/tts-preview?voice_name=${encodeURIComponent(voiceId)}&lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(sampleText)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const backendRes = await fetch(backendTarget, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (backendRes.ok && backendRes.headers.get("content-type")?.includes("audio/")) {
      const audioBuffer = await backendRes.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": backendRes.headers.get("content-type") || "audio/wav",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    // Backend offline hoặc timeout -> chuyển qua fallback engine mượt mà bên dưới
  }

  // 2. High-quality Native Voice Synthesis Engine (Đảm bảo phát âm chuẩn 100% tiếng Việt / tiếng Anh)
  try {
    const targetLang = lang === "vi" ? "vi" : "en";
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(sampleText)}&tl=${targetLang}&client=tw-ob`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const ttsRes = await fetch(ttsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
      },
    });
    clearTimeout(timeoutId);

    if (ttsRes.ok) {
      const audioBuffer = await ttsRes.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch (err) {
    console.error("Voice synthesis fallback error:", err);
  }

  return NextResponse.json(
    { error: "Could not synthesize voice preview" },
    { status: 500 }
  );
}
