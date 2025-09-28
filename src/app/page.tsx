"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="home-container">
      <div className="home-content">
        <h1 className="home-title">🚀 PromptBoostr</h1>
        <h2 className="home-subtitle">Coming Soon</h2>
        <p className="home-description">
          We&apos;re building a tool that helps you create the most powerful, precise, and effective prompts,
          in the simplest way possible. Stay tuned!
        </p>
        <div className="home-actions">
          <Link href="/wizard" className="wizard-button">
            Simple Wizard (DEV)
          </Link>
          <Link href="/tree-wizard" className="wizard-button">
            Conversational Wizard (DEV)
          </Link>
        </div>
      </div>

      <style jsx>{`
        .home-actions {
          display: flex;
          gap: 1rem; /* Adds space between the buttons */
          margin-top: 2.5rem; /* Adds more space above the buttons */
        }
        /* The .wizard-button class is on a Link, which renders an <a> tag.
           We target it directly to remove the underline. */
        .home-actions :global(.wizard-button) {
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
