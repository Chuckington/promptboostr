import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { messages, extractedData } = await req.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid 'messages' format" }, { status: 400 });
    }

    const systemPrompt = `You are a "Prompt Building Assistant". Your goal is to guide a user by asking one question at a time to build a perfect prompt.

The 5 core fields we MUST collect are: 'role', 'goal', 'context', 'format', 'constraints'.

The user has already provided the following information: ${JSON.stringify(extractedData)}.

Based on the conversation history and the provided data:
1.  Analyze the user's last message to extract any new key information.
2.  If this is the user's first response (conversation history has 2 messages), your next question MUST introduce the 5 core questions and then ask for the 'role'. For example: "Great, a poster! To build the best prompt, let's start with 5 core questions. First, what role should the AI take on for this task? (e.g., a graphic designer...)"
3.  After the first response, check if all 5 core fields are present in the extracted data.
4.  If any core fields are missing, your NEXT question MUST be to ask for one of the missing core fields. Prioritize them in order.
5.  If all 5 core fields are collected, ask a logical follow-up question to get more clarifying details (like style, tone, audience, subject, etc.).
6.  Your response MUST be a JSON object with two keys: "next_question" (string) and "extracted_data" (an object with any newly extracted key-value pairs).

Example for a missing core field: If 'goal' is missing, you might return: {"next_question": "What is the main goal of this prompt?", "extracted_data": {}}.

Never ask if the user is ready to generate. Always ask another question to refine the prompt.`;

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