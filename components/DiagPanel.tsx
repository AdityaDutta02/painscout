'use client';
import { useState } from 'react';
import { useEmbedToken } from '@/hooks/use-embed-token';

interface ProbeResult {
  step: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function DiagPanel() {
  const embedToken = useEmbedToken();
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

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
          <div className="font-medium">DB probe</div>
          <div className="text-xs text-neutral-600">
            Runs 6 inserts to find which column the gateway rejects. Remove once analyze works.
          </div>
        </div>
        <button className="btn-primary whitespace-nowrap" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run probes'}
        </button>
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
    </div>
  );
}
