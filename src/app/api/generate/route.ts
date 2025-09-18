// src/app/api/generate/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CORE_FIELDS = ["role", "goal", "context", "format", "constraints"] as const;
// Based on the project plan, these are potential optional fields.
const OPTIONAL_FIELDS = [
  "category", "subCategory", "audience", "tone", "length", "style",
  "subject", "mood", "palette", "detailLevel", "ratio",
  "dataType", "period", "deliverableType", "recommendationsCount",
  "complexity", "includeExample"
] as const;
const ALL_FIELDS = [...CORE_FIELDS, ...OPTIONAL_FIELDS];

type CoreInput = { [K in (typeof CORE_FIELDS)[number]]: string };
type OptionalInput = { [K in (typeof OPTIONAL_FIELDS)[number]]?: string };
type GenerateInput = CoreInput & OptionalInput;

function sanitize(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, 5000);
}

function validate(body: any): { ok: boolean; data?: GenerateInput; error?: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be JSON." };

  const data: any = {};
  // Sanitize all potential fields present in the body
  for (const f of ALL_FIELDS) {
    if (body[f] !== undefined && body[f] !== null) {
      data[f] = sanitize(body[f]);
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
      "\n\nConstruis: 1) 'markdown' concis (sections: Résumé, Instructions au modèle, Contraintes, Format attendu, Conseils d’usage), " +
      "2) 'structured' incluant 'final_prompt', et optionnellement 'few_shot_examples' et 'guidance'.";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 2048, // Increased tokens for potentially more complex prompts
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en création de 'Prompts Parfaits' pour les modèles de langage (LLM) et les générateurs d'images. " +
            "Ton objectif est de transformer la demande d'un utilisateur en un prompt structuré et de haute qualité. " +
            "L'utilisateur fournira des champs. Les 5 champs de base sont : Rôle, Objectif, Contexte, Format, Contraintes. " +
            "Il pourra aussi fournir une Catégorie ('Texte', 'Image', 'Analyse', 'Connaissance générale'), une Sous-Catégorie ('Email', 'Logo'), et d'autres champs d'affinage (audience, ton, style, longueur, etc.).\n\n" +
            "Ta réponse DOIT être un objet JSON avec deux clés : 'markdown' (string) et 'structured' (objet).\n\n" +
            "1. **Objet 'structured'** :\n" +
            "   - Recopie TOUS les champs d'entrée fournis par l'utilisateur.\n" +
            "   - `final_prompt`: Un prompt final, prêt à l'emploi, compact et actionnable. C'est la partie la plus importante. Adapte-le en fonction de la Catégorie :\n" +
            "     - Pour 'Texte', 'Analyse', 'Connaissance générale' : crée un prompt textuel pour un LLM.\n" +
            "     - Pour 'Image' : crée un prompt descriptif pour un modèle de génération d'images (DALL-E, Midjourney), incluant des détails visuels (sujet, style, ambiance, couleurs, composition).\n" +
            "   - `guidance` (objet optionnel) : Infère des conseils comme `style`, `tone`, `audience`, `success_criteria`.\n" +
            "   - `few_shot_examples` (tableau optionnel de 0-3 objets) : Si pertinent, fournis des exemples `{input, output}`.\n\n" +
            "2. **Chaîne 'markdown'** :\n" +
            "   - Un résumé concis et lisible du prompt, structuré avec les sections : Résumé, Instructions au modèle, Contraintes, Format attendu, Conseils d’usage."
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) return new Response(JSON.stringify({ ok: false, error: "No content returned by model." }), { status: 500 });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON from model:", raw);
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON from model.", raw_response: raw }), { status: 502 });
    }

    // Ensure the response contains the expected keys
    if (!parsed.markdown || !parsed.structured) {
      console.error("Malformed JSON from model (missing keys):", parsed);
      return new Response(JSON.stringify({ ok: false, error: "Malformed JSON from model (missing 'markdown' or 'structured' key).", raw_response: parsed }), { status: 502 });
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
      hint: "POST JSON { role, goal, context, format, constraints, ...optional_fields } to generate your Prompt Parfait."
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
