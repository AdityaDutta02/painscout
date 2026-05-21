'use client';
import { useState } from 'react';
import { useEmbedToken } from '@/hooks/use-embed-token';

interface ProbeResult {
  step: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface RedditProbe {
  ua: string;
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  bodySample: string;
  childrenCount: number | null;
  error?: string;
}

export function DiagPanel() {
  const embedToken = useEmbedToken();
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [redditProbes, setRedditProbes] = useState<RedditProbe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReddit, setLoadingReddit] = useState(false);
  const [err, setErr] = useState('');

  async function runReddit() {
    setLoadingReddit(true);
    setErr('');
    setRedditProbes(null);
    try {
      const res = await fetch('/api/test-reddit?sub=UXDesign');
      const data = (await res.json()) as { probes?: RedditProbe[]; error?: string };
      if (!res.ok || !data.probes) setErr(data.error ?? `HTTP ${res.status}`);
      else setRedditProbes(data.probes);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingReddit(false);
    }
  }

  async function run() {
    if (!embedToken) {
      setErr('No embed token yet — page may not be running inside the Terminal AI shell.');
      return;
    }
    setLoading(true);
    setErr('');
    setResults(null);
    try {
      const res = await fetch('/api/diag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedToken }),
      });
      const data = (await res.json()) as { results?: ProbeResult[]; error?: string };
      if (!res.ok || !data.results) {
        setErr(data.error ?? `HTTP ${res.status}`);
      } else {
        setResults(data.results);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-2xl border-amber-300 bg-amber-50/40 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-amber-700">Debug</div>
          <div className="font-medium">Diagnostics</div>
          <div className="text-xs text-neutral-600">
            DB probe checks gateway insert. Reddit probe checks if server can reach Reddit.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="btn-secondary whitespace-nowrap" onClick={run} disabled={loading}>
            {loading ? 'Running…' : 'DB probe'}
          </button>
          <button className="btn-secondary whitespace-nowrap" onClick={runReddit} disabled={loadingReddit}>
            {loadingReddit ? 'Running…' : 'Reddit probe'}
          </button>
        </div>
      </div>

      {err && (
        <pre className="text-xs whitespace-pre-wrap break-words text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {err}
        </pre>
      )}

      {results && (
        <ol className="space-y-2">
          {results.map((r) => (
            <li key={r.step} className="bg-white border border-neutral-200 rounded p-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${r.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {r.ok ? 'OK' : 'FAIL'}
                </span>
                <span className="font-medium text-sm">{r.step}</span>
              </div>
              {r.error && (
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-red-800">{r.error}</pre>
              )}
              {r.ok && (
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-neutral-600 max-h-32 overflow-auto">
                  {JSON.stringify(r.result, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}

      {redditProbes && (
        <ol className="space-y-2">
          {redditProbes.map((p, i) => (
            <li key={i} className="bg-white border border-neutral-200 rounded p-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded ${
                    p.ok && (p.childrenCount ?? 0) > 0
                      ? 'bg-green-100 text-green-800'
                      : p.status === 429
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {p.status} · {p.childrenCount ?? '–'} posts
                </span>
                <span className="font-mono break-all">{p.url}</span>
              </div>
              <div className="mt-1 text-neutral-500">UA: {p.ua}</div>
              <div className="mt-1 text-neutral-500">CT: {p.contentType}</div>
              {p.error && <div className="mt-1 text-red-700">{p.error}</div>}
              {p.bodySample && (
                <pre className="mt-1 whitespace-pre-wrap break-words text-neutral-600 max-h-24 overflow-auto">
                  {p.bodySample}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
