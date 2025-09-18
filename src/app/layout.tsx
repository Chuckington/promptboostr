import "./globals.css";
import "./style.css";

export const metadata = { title: "PromptBoostr", description: "Coming soon" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
