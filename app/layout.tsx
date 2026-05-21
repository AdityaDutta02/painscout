import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'PainScout',
  description: 'Reddit pain-points → ranked viral content problems',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="border-b border-neutral-200 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="font-semibold tracking-tight text-lg">
              PainScout<span className="text-accent">.</span>
            </a>
            <span className="text-xs text-neutral-500">Reddit pain → viral content briefs</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="max-w-5xl mx-auto px-6 py-6 text-xs text-neutral-500">
          Built on Terminal AI. Uses Reddit's public JSON endpoint for personal research only. No commercial redistribution.
        </footer>
      </body>
    </html>
  );
}
