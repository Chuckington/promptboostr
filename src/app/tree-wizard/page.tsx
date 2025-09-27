"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function TreeWizardPage() {
  // --- Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // --- State Management ---
  const [conversation, setConversation] = useState<Message[]>([]);
  const [extractedData, setExtractedData] = useState<Record<string, string>>({});
  const [showJson, setShowJson] = useState(false); // To toggle between text and JSON view
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyNotification, setCopyNotification] = useState("");
  const [error, setError] = useState<string | null>(null);

  // --- Final Prompt Generation State ---
  const [generatedMarkdown, setGeneratedMarkdown] = useState("");
  const [generatedStructured, setGeneratedStructured] = useState<object | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom of the chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  useEffect(() => {
    // On page load, check if the user is already authenticated in this session
    if (sessionStorage.getItem("is_authenticated") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Start the conversation with a welcome message once authenticated
  useEffect(() => {
    if (isAuthenticated && conversation.length === 0) {
    setConversation([{ role: "assistant", content: "Hello! What are we creating today?" }]);
    }
  }, [isAuthenticated, conversation.length]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const newUserMessage: Message = { role: "user", content: userInput };
    const newConversation = [...conversation, newUserMessage];
    setConversation(newConversation);
    setUserInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tree-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newConversation, extractedData }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to get a response.");

      // Add the assistant's new question to the conversation
      setConversation(prev => [...prev, { role: "assistant", content: data.next_question }]);
      // Merge newly extracted data with existing data
      setExtractedData(prev => ({ ...prev, ...data.extracted_data }));

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("fields", JSON.stringify(extractedData));

      const res = await fetch("/api/generate", {
        method: "POST",
        // The browser will set the 'Content-Type' to 'multipart/form-data'
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate prompt.");
      setGeneratedMarkdown(data.markdown);
      setGeneratedStructured(data.structured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatExtractedDataAsText = () => {
    return Object.entries(extractedData)
      .map(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
        return `${formattedKey}: ${value}`;
      })
      .join('\n');
  };

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotification("Copied to clipboard!");
      // Hide the notification after 2 seconds
      setTimeout(() => setCopyNotification(""), 2000);
    }).catch(() => {});
  }

  const userMessageCount = conversation.filter(m => m.role === 'user').length;

  // If not authenticated, show a password form
  if (!isAuthenticated) {
    return (
      <main className="wizard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Access Conversational Wizard</h1>
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
      {/* Left Panel: Conversational Wizard */}
      <div className="wizard-panel">
        <div className="wizard-header">
          <div>
            <h1>Conversational Wizard</h1>
            <p>Answer the questions to build your prompt.</p>
          </div>
        </div>
        <div className="chat-area">
          {conversation.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <p>{msg.content}</p>
            </div>
          ))}
          {loading && <div className="chat-message assistant"><p>Thinking...</p></div>}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="wizard-input"
            placeholder="Type your answer..."
            disabled={loading}
          />
          <button type="submit" className="wizard-button" disabled={loading}>Send</button>
        </form>

        <div className="wizard-form-actions" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button
            onClick={handleGeneratePrompt}
            className="wizard-button"
            disabled={userMessageCount < 8 || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Prompt"}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', lineHeight: '1.2' }}>
            Answer at least 8 questions to enable generation.
            <br />
            ({userMessageCount} / 8)
          </p>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="result-panel">
        <div className="result-section">
          {copyNotification && (
            <div className="copy-notification">
              {copyNotification}
            </div>
          )}
          <div className="result-header">
            <h2 style={{ textAlign: 'center', flexGrow: 1 }}>Collected Information</h2>
            <button onClick={() => setShowJson(!showJson)} className="copy-button" style={{ fontSize: '0.8rem' }}>
              {showJson ? 'Show Text' : 'Show JSON'}
            </button>
          </div>
          <pre className="result-content" style={{ maxHeight: '300px' }}>
            {showJson
              ? JSON.stringify(extractedData, null, 2)
              : formatExtractedDataAsText()
            }
          </pre>
          {error && <p className="wizard-error">{error}</p>}
        </div>

        {generatedMarkdown && (
          <div className="result-section">
            <div className="result-header">
              <h2>Markdown</h2>
              <button onClick={() => copy(generatedMarkdown)} className="copy-button">
                Copy
              </button>
            </div>
            <pre className="result-content">{generatedMarkdown}</pre>
          </div>
        )}
        {generatedStructured && (
          <div className="result-section">
            <div className="result-header">
              <h2>Structured JSON</h2>
              <div className="result-header-buttons">
                <button
                  onClick={() => copy(JSON.stringify(generatedStructured, null, 2))}
                  className="copy-button"
                >
                  Copy JSON
                </button>
                {(generatedStructured as { final_prompt?: string }).final_prompt && (
                  <button
                    onClick={() => copy((generatedStructured as { final_prompt: string }).final_prompt)}
                    className="copy-button"
                  >
                    Copy Prompt
                  </button>
                )}
              </div>
            </div>
            <pre className="result-content">{JSON.stringify(generatedStructured, null, 2)}</pre>
          </div>
        )}
      </div>

      <style jsx>{`
        .chat-input-form {
          display: flex;
          gap: 0.75rem; /* Adds space between input and button */
        }
        .chat-area {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem 0;
        }
        .chat-message {
          padding: 0.75rem 1.25rem;
          border-radius: 18px;
          max-width: 80%;
          line-height: 1.4;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-message p {
          margin: 0;
        }
        .chat-message.assistant {
          background-color: #333;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .chat-message.user {
          background-color: #007aff;
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
      `}</style>
    </main>
  );
}
