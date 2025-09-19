// src/app/api/generate/route.ts
import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";

const CORE_FIELDS = ["role", "goal", "context", "format", "constraints"] as const;
// Based on the project plan, these are potential optional fields.
const OPTIONAL_FIELDS = [
  "category", "subCategory", "audience", "tone", "length", "style",
  "subject", "mood", "palette", "detailLevel", "ratio",
  "dataType", "period", "deliverableType", "recommendationsCount",
  "complexity", "includeExample",
  "explicitRole",
  "validationCriteria"
] as const;
const ALL_FIELDS = [...CORE_FIELDS, ...OPTIONAL_FIELDS];

type CoreInput = { [K in (typeof CORE_FIELDS)[number]]: string };
type OptionalInput = { [K in (typeof OPTIONAL_FIELDS)[number]]?: string };
type GenerateInput = CoreInput & OptionalInput;

function sanitize(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, 5000);
}

function validate(body: unknown): { ok: boolean; data?: GenerateInput; error?: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be JSON." };

  const data: Partial<GenerateInput> = {};
  // Sanitize all potential fields present in the body
  for (const f of ALL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      const value = (body as Record<string, unknown>)[f];
      if (value !== undefined && value !== null) {
        data[f] = sanitize(value);
      }
    }
  }

  const missing = CORE_FIELDS.filter((f) => !data[f]);
  if (missing.length) return { ok: false, error: `Missing core fields: ${missing.join(", ")}` };
  return { ok: true, data: data as GenerateInput };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const v = validate(json);
    if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });

    const data = v.data!;

    // Dynamically build the user prompt content from all provided fields
    const userPromptParts = Object.entries(data).map(([key, value]) => {
      // Convert camelCase to a more readable format for the LLM
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
      return `${formattedKey}: ${value}`;
    });

    const userContent =
      userPromptParts.join('\n') +
      "\n\nBuild: 1) a concise 'markdown' (sections: Summary, Instructions for the model, Constraints, Expected format, Usage tips), " +
      "2) a 'structured' object including 'final_prompt', and optionally 'few_shot_examples' and 'guidance'.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 2048, // Increased tokens for potentially more complex prompts
      messages: [
        {
          role: "system",
          content:
            "You are an expert in creating 'Perfect Prompts' for language models (LLMs) and image generators. " +
            "Your goal is to transform a user's request into a structured, high-quality prompt. " +
            "The user will provide fields. The 5 core fields are: Role, Goal, Context, Format, Constraints. " +
            "They may also provide a Category ('Text', 'Image', 'Analysis', 'General Knowledge'), a Sub-Category ('Email', 'Logo'), and other refinement fields (audience, tone, style, length, etc.).\n\n" +
            "Your response MUST be a JSON object with two keys: 'markdown' (string) and 'structured' (object).\n\n" +
            "1. **'structured' object**:\n" +
            "   - Copy ALL input fields provided by the user.\n" +
            "   - `final_prompt`: A final, ready-to-use, compact, and actionable prompt. This is the most important part. Adapt it based on the Category:\n" +
            "     - For 'Text', 'Analysis', 'General Knowledge': create a text-based prompt for an LLM.\n" +
            "     - For 'Image': create a descriptive prompt for an image generation model (DALL-E, Midjourney), including visual details (subject, style, mood, colors, composition).\n" +
            "   - `guidance` (optional object): Infer advice like `style`, `tone`, `audience`, `success_criteria`.\n" +
            "   - `few_shot_examples` (optional array of 0-3 objects): If relevant, provide `{input, output}` examples.\n\n" +
            "2. **'markdown' string**:\n" +
            "   - A concise and readable summary of the prompt, structured with the sections: Summary, Instructions for the model, Constraints, Expected format, Usage tips."
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) return new Response(JSON.stringify({ ok: false, error: "No content returned by model." }), { status: 500 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON from model:", raw);
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON from model.", raw_response: raw }), { status: 502 });
    }

    const parsedResponse = parsed as { markdown?: unknown; structured?: unknown };
    // Ensure the response contains the expected keys
    if (typeof parsedResponse.markdown !== 'string' || typeof parsedResponse.structured !== 'object' || !parsedResponse.structured) {
      console.error("Malformed JSON from model (missing keys):", parsed);
      return new Response(JSON.stringify({ ok: false, error: "Malformed JSON from model (missing 'markdown' or 'structured' key).", raw_response: parsed }), { status: 502 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        model: completion.model,
        markdown: parsedResponse.markdown,
        structured: parsedResponse.structured
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error(err);
    let msg = "Unexpected server error.";
    let status = 500;
    if (err instanceof Error) {
      msg = err.message;
      // A bit of a hack to get status from OpenAI's error shape
      if ('status' in err && typeof (err as { status?: unknown }).status === 'number') {
        status = (err as { status: number }).status;
      }
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), { status });
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      hint: "POST JSON { role, goal, context, format, constraints, ...optional_fields } to generate your Prompt Parfait."
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
