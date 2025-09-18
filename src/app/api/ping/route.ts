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
  } catch (e: any) {
    // Gestion propre des erreurs de quota
    const code = e?.code || "unknown";
    const status = e?.status || 500;
    const message =
      code === "insufficient_quota"
        ? "OpenAI quota exceeded: add billing or enable MOCK_AI to develop without calling the API."
        : e?.message || "Unexpected error";

    return NextResponse.json({ ok: false, code, message }, { status: status === 429 ? 429 : 500 });
  }
}
