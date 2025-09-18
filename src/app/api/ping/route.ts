import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function GET() {
  // Mode mock pour dev sans quota/carte
  if (process.env.MOCK_AI === "true") {
    return NextResponse.json({ ok: true, model: "mock", text: "pong" });
  }

  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a concise assistant." },
        { role: "user", content: "Reply with 'pong' only." }
      ],
      max_tokens: 5,
    });

    const text = r.choices[0]?.message?.content ?? "no response";
    return NextResponse.json({ ok: true, model: "gpt-4o-mini", text });
  } catch (e: unknown) {
    // Gestion propre des erreurs de quota
    const error = e as { code?: string; status?: number; message?: string };
    const code = error?.code || "unknown";
    const status = error?.status || 500;
    let message = error?.message || "Unexpected error";

    if (code === "insufficient_quota") {
      message = "OpenAI quota exceeded: add billing or enable MOCK_AI to develop without calling the API.";
    }

    return NextResponse.json({ ok: false, code, message }, { status: status === 429 ? 429 : 500 });
  }
}
