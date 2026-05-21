'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DiagPanel } from '@/components/DiagPanel';

export default function Home() {
  const router = useRouter();
  const [niche, setNiche] = useState('');

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (niche.trim().length < 2) return;
    sessionStorage.setItem('painscout:niche', niche.trim());
    router.push('/analyze/new');
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Find what your audience is silently begging you to talk about.</h1>
        <p className="text-neutral-600 max-w-2xl">
          Type a niche. PainScout asks you 4 quick questions, scrapes real Reddit pain points, and gives you a ranked list of problems ready
          to turn into viral reels, carousels, or posts.
        </p>
      </section>

      <form onSubmit={start} className="card space-y-4 max-w-2xl">
        <label className="block">
          <span className="text-sm font-medium">What niche?</span>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. UX design, indie game dev, plumbing SaaS, RevOps for startups"
            className="input mt-2"
            autoFocus
          />
        </label>
        <button type="submit" className="btn-primary" disabled={niche.trim().length < 2}>
          Find pain points →
        </button>
      </form>

      <section className="grid sm:grid-cols-3 gap-4 text-sm">
        <div className="card">
          <div className="font-medium mb-1">1. Tell us the niche</div>
          <div className="text-neutral-600">You name it. We adapt every question to it.</div>
        </div>
        <div className="card">
          <div className="font-medium mb-1">2. Answer 4 quick questions</div>
          <div className="text-neutral-600">AI generates the questions live, niche-specific options.</div>
        </div>
        <div className="card">
          <div className="font-medium mb-1">3. Get ranked problems</div>
          <div className="text-neutral-600">Scrape + cluster + rank by viral signal. Export markdown.</div>
        </div>
      </section>

      <DiagPanel />
    </div>
  );
}
