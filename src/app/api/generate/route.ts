// src/app/api/generate/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type GenerateInput = {
  role: string;
  goal: string;
  context: string;
  format: string;
  constraints: string;
};

function sanitize(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, 5000);
}

function validate(body: any): { ok: boolean; data?: GenerateInput; error?: string } {
  const fields = ["role", "goal", "context", "format", "constraints"] as const;
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be JSON." };
  const data: any = {};
  for (const f of fields) data[f] = sanitize(body[f]);
  const missing = fields.filter((f) => !data[f]);
  if (missing.length) return { ok: false, error: `Missing fields: ${missing.join(", ")}` };
  return { ok: true, data };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const v = validate(json);
    if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });

    const { role, goal, context, format, constraints } = v.data!;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }, // ← JSON mode (supported broadly)
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "Tu fabriques un 'Prompt Parfait' à partir de 5 champs: Rôle, Objectif, Contexte, Format, Contraintes. " +
            "Réponds UNIQUEMENT en JSON avec deux clés: 'markdown' (string) et 'structured' (objet). " +
            "Dans 'structured', recopie les 5 champs d'entrée et fournis 'final_prompt' (prompt prêt à l'emploi, compact et actionnable). " +
            "Ajoute éventuellement 'few_shot_examples' (0-3 objets {input, output}) et 'guidance' ({style, tone, audience, success_criteria})."
        },
        {
          role: "user",
          content:
            `RÔLE: ${role}\n` +
            `OBJECTIF: ${goal}\n` +
            `CONTEXTE: ${context}\n` +
            `FORMAT: ${format}\n` +
            `CONTRAINTES: ${constraints}\n\n` +
            "Construis: 1) 'markdown' concis (sections: Résumé, Instructions au modèle, Contraintes, Format attendu, Conseils d’usage), " +
            "2) 'structured' incluant 'final_prompt', et optionnellement 'few_shot_examples' et 'guidance'."
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) {
      return new Response(JSON.stringify({ ok: false, error: "No content returned by model." }), { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON from model." }), { status: 502 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        model: completion.model,
        markdown: parsed.markdown,
        structured: parsed.structured
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    const msg = typeof err?.message === "string" ? err.message : "Unexpected server error.";
    const status = Number(err?.status) || 500;
    return new Response(JSON.stringify({ ok: false, error: msg }), { status });
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      hint: "POST JSON { role, goal, context, format, constraints } to generate your Prompt Parfait."
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
