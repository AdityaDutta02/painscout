'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEmbedToken } from '@/hooks/use-embed-token';

interface HistoryItem {
  id: string;
  niche: string;
  status: string;
  raw_post_count: number;
  problem_count: number;
  created_at: string | null;
}

type Stage = 'loading' | 'loaded' | 'error';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'done'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'failed'
        ? 'bg-red-50 text-red-700 border-red-200'
        : status === 'running'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-neutral-100 text-neutral-700 border-neutral-200';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded border ${styles}`}>{status}</span>;
}

export default function History() {
  const embedToken = useEmbedToken();
  const [stage, setStage] = useState<Stage>('loading');
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!embedToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/history?viewerId=viewer', {
          headers: { 'x-embed-token': embedToken },
        });
        const data = (await res.json()) as { items?: HistoryItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.items) {
          setErrorMsg(data.error ?? 'Failed to load history');
          setStage('error');
          return;
        }
        setItems(data.items);
        setStage('loaded');
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [embedToken]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-neutral-600">Past pain-point analyses. Click to re-open.</p>
      </section>

      {stage === 'loading' && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
              <div className="h-3 w-1/2 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {stage === 'error' && (
        <div className="card space-y-3">
          <div className="text-sm font-medium">Couldn&apos;t load history</div>
          <pre className="text-xs text-neutral-700 whitespace-pre-wrap break-words">{errorMsg}</pre>
        </div>
      )}

      {stage === 'loaded' && items.length === 0 && (
        <div className="card space-y-3">
          <div className="text-sm">No past analyses yet.</div>
          <Link href="/" className="btn-primary inline-block">
            Start one →
          </Link>
        </div>
      )}

      {stage === 'loaded' && items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/analyze/${it.id}`}
              className="card flex items-center justify-between gap-4 hover:border-neutral-400 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{it.niche}</div>
                <div className="text-xs text-neutral-500 mt-1">{formatDate(it.created_at)}</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-600 shrink-0">
                <span>{it.problem_count} problems</span>
                <span>·</span>
                <span>{it.raw_post_count} posts</span>
                <StatusBadge status={it.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
