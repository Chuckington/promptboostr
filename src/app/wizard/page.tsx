"use client";

import { useState, useReducer, useEffect } from "react";

type Structured = {
  final_prompt: string;
  [key: string]: unknown;
};

const initialFormState = {
  role: "",
  goal: "",
  context: "",
  format: "",
  constraints: "",
  explicitRole: "",
  audience: "",
  validationCriteria: "",
};

type FormState = typeof initialFormState;
type FormAction = { type: 'SET_FIELD'; field: keyof FormState; payload: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.payload };
    default:
      return state;
  }
}

export default function WizardPage() { // Renamed component
  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // --- Form State ---
  const [formState, dispatch] = useReducer(formReducer, initialFormState);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- File Upload State ---
  const [file, setFile] = useState<File | null>(null);
  const [copyNotification, setCopyNotification] = useState("");

  const [markdown, setMarkdown] = useState<string>("");
  const [structured, setStructured] = useState<Structured | null>(null);

  // On page load, check if the user is already authenticated in this session
  useEffect(() => {
    if (sessionStorage.getItem("is_authenticated") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    // The password MUST be stored in an environment variable for security
    if (passwordInput === process.env.NEXT_PUBLIC_WIZARD_PASSWORD) {
      setIsAuthenticated(true);
      // Store the authentication status in session storage
      sessionStorage.setItem("is_authenticated", "true");
      setAuthError("");
    } else {
      setAuthError("Incorrect password.");
      setPasswordInput("");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMarkdown("");
    setStructured(null);

    const formData = new FormData();
    const formFields = Object.fromEntries(Object.entries(formState).filter(([, value]) => value));

    // Append form fields as a single JSON string
    formData.append("fields", JSON.stringify(formFields));

    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        // The browser will set the 'Content-Type' to 'multipart/form-data'
        body: formData,
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
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotification("Copied to clipboard!");
      // Hide the notification after 2 seconds
      setTimeout(() => setCopyNotification(""), 2000);
    }).catch(() => {});
  }

  // If not authenticated, show a password form
  if (!isAuthenticated) {
    return (
      <main className="wizard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Access Wizard</h1>
          <p>Please enter the password to continue.</p>
          <form
            onSubmit={handlePasswordSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem', minWidth: '300px' }}
          >
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="wizard-input"
              placeholder="Password"
              autoFocus
            />
            <button type="submit" className="wizard-button">
              Enter
            </button>
            {authError && <p className="wizard-error" style={{ marginTop: '0.5rem' }}>{authError}</p>}
          </form>
        </div>
      </main>
    );
  }

  // If authenticated, show the wizard
  return (
    <main className="wizard-container">
      {/* Left Panel: Wizard Form */}
      <div className="wizard-panel">
        <div className="wizard-header">
          <div>
            <h1>PromptBoostr Wizard</h1>
            <p>Fill the fields to generate your perfect prompt.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="wizard-form">
          <div className="wizard-form-group">
            <label className="wizard-label">Role</label>
            <input
              className="wizard-input"
              placeholder="e.g., UX Expert, Tech Writer, Marketing Analyst..."
              value={formState.role}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'role', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Goal</label>
            <input
              className="wizard-input"
              placeholder="e.g., Write an implementation plan, Generate an email..."
              value={formState.goal}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'goal', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Context</label>
            <textarea
              className="wizard-textarea"
              rows={4}
              placeholder="Key info: audience, business constraints, available data..."
              value={formState.context}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'context', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Format</label>
            <input
              className="wizard-input"
              placeholder="e.g., 5-step plan, Email, JSON, Markdown table..."
              value={formState.format}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'format', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Constraints</label>
            <textarea
              className="wizard-textarea"
              rows={3}
              placeholder="e.g., Professional tone, max 500 words, no jargon..."
              value={formState.constraints}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'constraints', payload: e.target.value })}
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
              value={formState.explicitRole}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'explicitRole', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Clear Audience</label>
            <input
              className="wizard-input"
              placeholder="e.g., Marketing directors of startups with 10-50 employees"
              value={formState.audience}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'audience', payload: e.target.value })}
            />
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Validation Criteria</label>
            <textarea
              className="wizard-textarea"
              rows={2}
              placeholder="e.g., The output must be actionable, under 300 words, and include a CTA."
              value={formState.validationCriteria}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'validationCriteria', payload: e.target.value })}
            />
          </div>

          <div className="wizard-optional-divider">
            <span>Optional: Add a document for context</span>
          </div>

          <div className="wizard-form-group">
            <label className="wizard-label">Context Document (Image, etc.)</label>
            {/* We hide the default file input and use a styled label instead */}
            <label htmlFor="file-upload" className="wizard-file-upload-label">
              {file ? file.name : "Click to upload a file..."}
            </label>
            <input
              id="file-upload"
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ display: 'none' }}
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
        {copyNotification && (
          <div className="copy-notification">
            {copyNotification}
          </div>
        )}

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

      {/* Styles to prevent result boxes from overflowing the screen */}
      <style jsx>{`
        /* Most layout styles are now global. We only need specific overrides here. */
        .result-section {
          min-height: 0; /* Helps contain the scrolling area within flexbox */
        }
        .result-content {
          overflow: auto; /* Adds scrollbars to the code blocks when needed */
        }
        .wizard-file-upload-label {
          display: block;
          padding: 10px 15px;
          background-color: #2c2c2c;
          border: 1px solid #444;
          border-radius: 8px;
          cursor: pointer;
          color: #9e9e9e; /* Placeholder text color */
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wizard-file-upload-label:hover {
          border-color: #666;
        }
        .wizard-form {
          overflow-y: auto; /* Make the form itself scrollable */
        }
      `}</style>
    </main>
  );
}