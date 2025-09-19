"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Structured = {
  final_prompt: string;
  [key: string]: unknown;
};

export default function WizardPage() { // Renamed component
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [format, setFormat] = useState("");
  const [constraints, setConstraints] = useState("");
  const [explicitRole, setExplicitRole] = useState("");
  const [audience, setAudience] = useState("");
  const [validationCriteria, setValidationCriteria] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const [markdown, setMarkdown] = useState<string>("");
  const [structured, setStructured] = useState<Structured | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMarkdown("");
    setStructured(null);

    const body: Record<string, string> = { role, goal, context, format, constraints };
    if (explicitRole) body.explicitRole = explicitRole;
    if (audience) body.audience = audience;
    if (validationCriteria) body.validationCriteria = validationCriteria;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "An error occurred.");
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="wizard-container">
      {/* Left Panel: Wizard Form */}
      <div className="wizard-panel">
        <div className="wizard-header">
          <div>
            <h1>PromptBoostr Wizard</h1>
            <p>Fill the fields to generate your perfect prompt.</p>
          </div>
          <button onClick={handleSignOut} className="signout-button">
            Sign Out
          </button>
        </div>

        <form onSubmit={onSubmit} className="wizard-form">
          <div className="wizard-form-group">
            <label className="wizard-label">Role</label>
            <input
              className="wizard-input"
              placeholder="e.g., UX Expert, Tech Writer, Marketing Analyst..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Goal</label>
            <input
              className="wizard-input"
              placeholder="e.g., Write an implementation plan, Generate an email..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Context</label>
            <textarea
              className="wizard-textarea"
              rows={4}
              placeholder="Key info: audience, business constraints, available data..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Format</label>
            <input
              className="wizard-input"
              placeholder="e.g., 5-step plan, Email, JSON, Markdown table..."
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Constraints</label>
            <textarea
              className="wizard-textarea"
              rows={3}
              placeholder="e.g., Professional tone, max 500 words, no jargon..."
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
          </div>

          <div className="wizard-optional-divider">
            <span>Optional: for a more robust prompt</span>
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Explicit Role</label>
            <input
              className="wizard-input"
              placeholder="e.g., A senior copywriter specialized in B2B SaaS"
              value={explicitRole}
              onChange={(e) => setExplicitRole(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Clear Audience</label>
            <input
              className="wizard-input"
              placeholder="e.g., Marketing directors of startups with 10-50 employees"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Validation Criteria</label>
            <textarea
              className="wizard-textarea"
              rows={2}
              placeholder="e.g., The output must be actionable, under 300 words, and include a CTA."
              value={validationCriteria}
              onChange={(e) => setValidationCriteria(e.target.value)}
            />
          </div>

          <div className="wizard-form-actions">
            <button type="submit" disabled={loading} className="wizard-button">
              {loading ? "Generating..." : "Generate"}
            </button>
            {error && <span className="wizard-error">{error}</span>}
          </div>
        </form>
      </div>

      {/* Right Panel: Results */}
      <div className="result-panel">
        {!loading && !markdown && !structured && (
          <div className="result-placeholder">
            <h2>Your generated prompt will appear here.</h2>
            <p>Fill out the form and click &quot;Generate&quot;.</p>
          </div>
        )}

        {loading && (
          <div className="result-placeholder">
            <h2>Generating...</h2>
            <p>Please wait a moment.</p>
          </div>
        )}

        {markdown && (
          <div className="result-section">
            <div className="result-header">
              <h2>Markdown</h2>
              <button onClick={() => copy(markdown)} className="copy-button">
                Copy
              </button>
            </div>
            <pre className="result-content">{markdown}</pre>
          </div>
        )}

        {structured && (
          <div className="result-section">
            <div className="result-header">
              <h2>Structured JSON</h2>
              <div className="result-header-buttons">
                <button
                  onClick={() => copy(JSON.stringify(structured, null, 2))}
                  className="copy-button"
                >
                  Copy JSON
                </button>
                {structured.final_prompt && (
                  <button
                    onClick={() => copy(structured.final_prompt)}
                    className="copy-button"
                  >
                    Copy Prompt
                  </button>
                )}
              </div>
            </div>
            <pre className="result-content">{JSON.stringify(structured, null, 2)}</pre>
          </div>
        )}
      </div>
    </main>
  );
}