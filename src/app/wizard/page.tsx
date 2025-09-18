// src/app/wizard/page.tsx
"use client";

import { useState } from "react";

type Structured = {
  role: string;
  goal: string;
  context: string;
  format: string;
  constraints: string;
  final_prompt: string;
  few_shot_examples?: { input: string; output: string }[];
  guidance?: { style?: string; tone?: string; audience?: string; success_criteria?: string };
};

export default function WizardPage() {
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [format, setFormat] = useState("");
  const [constraints, setConstraints] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [markdown, setMarkdown] = useState<string>("");
  const [structured, setStructured] = useState<Structured | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setMarkdown("");
    setStructured(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, goal, context, format, constraints }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Request failed.");
      } else {
        setMarkdown(data.markdown || "");
        setStructured(data.structured || null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown network error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Prompt Parfait — Wizard</h1>
      <p className="text-sm text-gray-400">
        Remplis les 5 champs, puis génère ton prompt (Markdown + JSON export).
      </p>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium">Rôle</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ex.: Expert UX, Coach Lean Six Sigma, Rédacteur technique…"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Objectif</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ex.: Rédiger un plan d’implémentation, Générer un e-mail, etc."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Contexte</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder="Infos clés: audience, contraintes business, données disponibles, outils…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Format</label>
          <input
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Ex.: Plan en 5 étapes, Email, JSON, Tableau, Markdown…"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Contraintes</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-900 p-3 outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Ex.: Ton pro, FR/EN, ≤ 500 mots, sources, style…"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Génération…" : "Generate"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </form>

      {(markdown || structured) && (
        <section className="space-y-4">
          {markdown && (
            <div className="rounded-2xl border border-gray-800">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                <h2 className="text-lg font-semibold">Markdown</h2>
                <button
                  onClick={() => copy(markdown)}
                  className="rounded-lg bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700"
                >
                  Copier
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words p-4 text-sm text-gray-200">
                {markdown}
              </pre>
            </div>
          )}

          {structured && (
            <div className="rounded-2xl border border-gray-800">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                <h2 className="text-lg font-semibold">JSON (export machine)</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(JSON.stringify(structured, null, 2))}
                    className="rounded-lg bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700"
                  >
                    Copier
                  </button>
                  {structured.final_prompt && (
                    <button
                      onClick={() => copy(structured.final_prompt)}
                      className="rounded-lg bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700"
                    >
                      Copier le prompt
                    </button>
                  )}
                </div>
              </div>
              <pre className="overflow-x-auto p-4 text-sm text-gray-200">
                {JSON.stringify(structured, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
