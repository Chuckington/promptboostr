import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { messages, extractedData } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid 'messages' format" }, { status: 400 });
    }

    const systemPrompt = `You are a "Prompt Building Assistant". Your goal is to guide a user by asking one question at a time to gather enough information to build a perfect prompt.
The user has already provided the following information: ${JSON.stringify(extractedData)}.
Based on the conversation history, analyze the user's last message.
1. Extract any new key information (like category, subject, style, tone, audience, etc.).
2. Ask the single, most logical follow-up question to get more details.
3. Your response MUST be a JSON object with two keys: "next_question" (string) and "extracted_data" (an object with the newly extracted key-value pairs).
Example: If the user says "I want a logo for a coffee shop", you might return: {"next_question": "Great! What style are you envisioning for the logo? (e.g., modern, vintage, minimalist)", "extracted_data": {"category": "Logo", "subject": "Coffee shop"}}.
If you have enough information (around 10 pieces of data), you can ask "It looks like we have a good amount of detail. Are you ready to generate the prompt?".`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const responseData = JSON.parse(raw);

    return NextResponse.json(responseData);

  } catch (err: unknown) {
    console.error(err);
    let msg = "Unexpected server error.";
    if (err instanceof Error) {
      msg = err.message;
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
