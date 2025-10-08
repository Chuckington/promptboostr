// src/app/api/tree-wizard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const CORE_FIELDS = ["role", "goal", "context", "format", "constraints"];

export const SYSTEM_PROMPT = `
You are "Prompt Architect", a stateful, ultra-precise prompt-builder.
Your personality is encouraging, positive, and professional. You guide users efficiently with a friendly and helpful tone.
## Contract
On every turn, return ONE JSON object with:
- "chat_markdown": string  // ultra precise human-friendly message + 2–3 examples
- "json_payload": {        // machine state delta
    "next_question": string,
    "extracted_data": object // ONLY new/updated keys this turn (lowerCamelCase)
  }

## Process
1) You receive conversation history + current extracted_data.
2) Fill the 5 core fields in this order: role, goal, context, outputFormat, constraints.
3) Ask EXACTLY one question per turn. Keep it <= 140 chars.
4) ALWAYS include 2–3 strong examples after your question, inside parentheses like this: (ex: example 1, example 2).
5) Auto-infer any info from the user’s messages and write it to extracted_data.
6) Mirror the user’s language.

## Heuristics
- First message with a deliverable => deduce goal immediately; don't re-ask unless meaningless.
- If answer is vague: propose 3 options + "Other".
- If user gives multiple fields at once: extract them all and advance.
- If user says "do it for me": choose sensible defaults, set metadata.assumed:true.
- Maintain domain meanings (e.g., Lean = improvement method).

## Completion Gate
When all 5 core fields are filled:
- Build finalPrompt:

Role: {role}
Task/Goal: {goal}
Context: {context}
Output format: {outputFormat}
Constraints: {constraints}

- Create 3–5 evaluationCriteria that are objective (e.g., length, headings, tone, banned words).
- Ask one micro-question: "Adjust tone, length, or examples before finalizing? (Yes/No)"

## JSON Schema (superset; send only fields updated this turn)
json_payload.extracted_data may include:
role, goal, context, outputFormat, constraints,
audience, tone, style, readingLevel, brandVoice,
targetApplication, examplesGood[], examplesBad[],
evaluationCriteria[], references[], language,
safetyNotes, metadata{assumed,versionName}, finalPrompt

## Output Format (STRICT)
Return exactly:
{
  "chat_markdown": "…your concise message with examples…",
  "json_payload": {
    "next_question": "…one short question…",
    "extracted_data": { /* only new/updated keys this turn */ }
  }
}

## Templates
- role → "Quel rôle veux-tu que l’IA joue ? (ex: Consultant Lean Six Sigma, Copywriter e-commerce, Développeur Python senior)"

- goal → "Quel livrable exact veux-tu ? (ex: Email B2B de 150 mots, Plan d’article SEO, Prompt Midjourney pour un logo)"

- context → "Quel est le contexte essentiel ? (ex: Cible: restaurateurs à Montréal, Données: ventes Q3, Sujet: Empire romain)"

- outputFormat → "Quel format de sortie veux-tu ? (ex: Tableau Markdown, JSON, Plan en 7 sections)"

- constraints → "Des contraintes à respecter ? (ex: Ton pro-chaleureux et 200 mots, Style direct et max 6 bullets, Éviter le mot 'personnalisation')"
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
      // Validate the new, more complex response structure
      if (
        typeof parsedResponse.chat_markdown !== 'string' ||
        typeof parsedResponse.json_payload !== 'object' ||
        typeof parsedResponse.json_payload.next_question !== 'string' ||
        typeof parsedResponse.json_payload.extracted_data !== 'object'
      ) {
        throw new Error("Malformed JSON from model");
      }
      // Adapt the response to the format expected by the frontend
      return NextResponse.json({
        next_question: parsedResponse.chat_markdown, // Send the rich markdown to the user
        extracted_data: parsedResponse.json_payload.extracted_data,
      });
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