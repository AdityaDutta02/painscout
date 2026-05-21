'use client';
import { useEffect, useState } from 'react';
import { useEmbedToken } from '@/hooks/use-embed-token';

interface Problem {
  rank: number;
  title: string;
  description: string;
  format_fit: string;
  viral_lever: string;
  source_urls: string[];
  signal: number;
}

interface Analysis {
  id: string;
  niche: string;
  subs: string[];
  answers: Record<string, string>;
  status: string;
  problems: Problem[];
  raw_post_count: number;
  error?: string;
  created_at: string;
}

export default function ResultsPage({ params }: { params: { id: string } }) {
  const embedToken = useEmbedToken();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!embedToken) return;
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/analyze/${params.id}`, {
          headers: { 'x-embed-token': embedToken ?? '' },
        });
        const data = (await res.json()) as Analysis | { error: string };
        if (stop) return;
        if (!res.ok) {
          setErr((data as { error: string }).error ?? 'Not found');
          return;
        }
        setAnalysis(data as Analysis);
        if ((data as Analysis).status === 'running') setTimeout(tick, 2000);
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
    }
    void tick();
    return () => {
      stop = true;
    };
  }, [embedToken, params.id]);

  if (err) {
    return (
      <div className="card max-w-2xl space-y-2">
        <div className="text-lg font-medium">Error</div>
        <div className="text-sm">{err}</div>
        <a className="btn-secondary" href="/">
          Start over
        </a>
      </div>
    );
  }
  if (!analysis) {
    return <div className="card max-w-2xl text-sm text-neutral-600">Loading…</div>;
  }
  if (analysis.status === 'running') {
    return (
      <div className="card max-w-2xl space-y-2">
        <div className="font-medium">Analyzing r/{analysis.subs.join(', r/')}…</div>
        <div className="text-sm text-neutral-600">Scraping Reddit, scoring posts, clustering pain. ~60-90s.</div>
      </div>
    );
  }
  if (analysis.status === 'failed') {
    return (
      <div className="card max-w-2xl space-y-2">
        <div className="text-lg font-medium">Analysis failed</div>
        <div className="text-sm text-neutral-700">{analysis.error}</div>
        <a className="btn-secondary" href="/">
          Try again
        </a>
      </div>
    );
  }

  const exportUrl = `/api/export/${analysis.id}?t=${encodeURIComponent(embedToken ?? '')}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">PainScout report</div>
        <h1 className="text-3xl font-semibold tracking-tight">{analysis.niche}</h1>
        <div className="text-sm text-neutral-600">
          {analysis.problems?.length ?? 0} problems · {analysis.raw_post_count} posts scanned · r/{analysis.subs.join(', r/')}
        </div>
        <div className="flex gap-2 pt-2">
          <a className="btn-secondary" href={exportUrl}>
            Download markdown
          </a>
          <a className="btn-secondary" href="/">
            New analysis
          </a>
        </div>
      </header>

      {(analysis.problems ?? []).length === 0 ? (
        <div className="card text-sm text-neutral-700">
          No pain signal found in the selected subs. Try wider time window or different subs.
        </div>
      ) : (
        <ol className="space-y-4">
          {analysis.problems.map((p) => (
            <li key={p.rank} className="card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">#{p.rank} · signal {p.signal}</div>
                  <div className="text-lg font-semibold mt-1">{p.title}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-neutral-100 border border-neutral-300 whitespace-nowrap">
                  {p.format_fit}
                </span>
              </div>
              <div className="text-sm text-neutral-800">{p.description}</div>
              <div className="text-sm text-neutral-600">
                <span className="font-medium text-ink">Viral lever:</span> {p.viral_lever}
              </div>
              {p.source_urls?.length > 0 && (
                <div className="text-xs text-neutral-600 space-y-1">
                  <div className="font-medium text-ink">Sources:</div>
                  <ul className="space-y-1">
                    {p.source_urls.map((u) => (
                      <li key={u}>
                        <a className="underline hover:no-underline" href={u} target="_blank" rel="noreferrer">
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
