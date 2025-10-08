// src/app/api/tree-wizard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const CORE_FIELDS = ["role", "goal", "context", "format", "constraints"];

const SYSTEM_PROMPT = `
You are a "Prompt Architect" assistant. Your goal is to guide a user to build a perfect prompt by asking one question at a time.

**Your process:**
1.  You will be given the conversation history and a JSON object of already 'extracted_data'.
2.  Your primary goal is to fill the 5 core fields: ${CORE_FIELDS.join(", ")}.
3.  Ask one question at a time to get the information for the next empty field.
4.  Once all 5 core fields are filled, you can ask for optional refinement fields like 'audience', 'tone', 'style', 'targetApplication', etc.

**Key Instructions:**
*   **Deduce the 'goal'**: The user's first message is their answer to "What are we creating today?". You MUST interpret this first answer as the 'goal'. Only ask for the 'goal' again if their first answer was completely unclear (e.g., "hi" or "I don't know").
*   **Always provide examples**: When you ask a question, you MUST provide 2-3 diverse and clear examples of what a good answer would look like. Format them as a list. This is the most important rule.
*   **Be concise**: Keep your questions short and to the point.
*   **Your response MUST be a valid JSON object** with two keys:
    - "next_question": (string) Your next question for the user.
    - "extracted_data": (object) A JSON object containing ANY new data you extracted from the user's last message. The keys should be camelCase (e.g., 'role', 'goal', 'targetApplication').

**Example of a good question:**
"Great. Now, what is the context for this task?

For example:
- 'This is for a marketing campaign targeting young professionals.'
- 'The data is from our Q3 sales report and contains sensitive information.'
- 'I'm a student working on a history essay about the Roman Empire.'"
`;

export async function POST(req: NextRequest) {
  try {
    const { messages, extractedData } = await req.json();

    if (!messages || !Array.isArray(messages) || !extractedData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // If this is the first user message, treat it as the goal.
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 1 && !extractedData.goal) {
      const firstAnswer = userMessages[0].content;
      // A simple heuristic to check if the answer is meaningful
      if (firstAnswer.trim().length > 5 && !/^(hi|hello|idk|i don't know)$/i.test(firstAnswer.trim())) {
        extractedData.goal = firstAnswer;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...messages,
        {
          role: "system",
          content: `Here is the data extracted so far. Do not ask for these fields again unless you need clarification. Extracted data: ${JSON.stringify(extractedData)}`,
        }
      ],
      temperature: 0.5,
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      return NextResponse.json({ error: "The model did not return a response." }, { status: 500 });
    }

    try {
      const parsedResponse = JSON.parse(rawResponse);
      // Basic validation of the parsed response
      if (typeof parsedResponse.next_question !== 'string' || typeof parsedResponse.extracted_data !== 'object') {
        throw new Error("Malformed JSON from model");
      }
      return NextResponse.json(parsedResponse);
    } catch (e) {
      console.error("Failed to parse JSON from model:", rawResponse);
      // Fallback: if JSON is broken, ask a generic question
      return NextResponse.json({
        next_question: "Could you please clarify that? I had trouble understanding.",
        extracted_data: {}
      });
    }

  } catch (err: unknown) {
    console.error(err);
    const error = err as Error;
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "This is the conversational wizard API. POST with { messages, extractedData }."
  });
}