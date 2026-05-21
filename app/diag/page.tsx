'use client';
import { useState } from 'react';
import { useEmbedToken } from '@/hooks/use-embed-token';

interface ProbeResult {
  step: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export default function DiagPage() {
  const embedToken = useEmbedToken();
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    if (!embedToken) {
      setErr('No embed token yet');
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
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Diagnostic</div>
        <h1 className="text-2xl font-semibold">DB probe</h1>
        <div className="text-sm text-neutral-600">
          Runs a sequence of inserts against the analyses table. First failure tells us which column or type the gateway is rejecting.
        </div>
      </header>

      <button className="btn-primary" onClick={run} disabled={loading || !embedToken}>
        {loading ? 'Running…' : 'Run probes'}
      </button>

      {err && <div className="card text-sm text-red-700 border-red-300">{err}</div>}

      {results && (
        <ol className="space-y-2">
          {results.map((r) => (
            <li key={r.step} className="card">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${r.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {r.ok ? 'OK' : 'FAIL'}
                </span>
                <span className="font-medium">{r.step}</span>
              </div>
              {r.error && (
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-red-800">{r.error}</pre>
              )}
              {r.ok && (
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-neutral-600 max-h-40 overflow-auto">
                  {JSON.stringify(r.result, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
