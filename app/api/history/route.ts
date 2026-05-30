import { NextRequest, NextResponse } from 'next/server';
import { dbList } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RawAnalysisRow {
  id: string;
  niche: string;
  status: string;
  raw_post_count?: number;
  problems?: unknown[];
  created_at?: string;
  viewer_id?: string;
}

interface HistoryItem {
  id: string;
  niche: string;
  status: string;
  raw_post_count: number;
  problem_count: number;
  created_at: string | null;
}

export async function GET(req: NextRequest) {
  const embedToken = req.headers.get('x-embed-token') ?? '';
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });

  const viewerId = req.nextUrl.searchParams.get('viewerId') ?? 'viewer';

  try {
    const rows = (await dbList('analyses', { viewer_id: viewerId }, embedToken)) as RawAnalysisRow[];
    const items: HistoryItem[] = rows
      .map((r) => ({
        id: r.id,
        niche: r.niche,
        status: r.status,
        raw_post_count: r.raw_post_count ?? 0,
        problem_count: Array.isArray(r.problems) ? r.problems.length : 0,
        created_at: r.created_at ?? null,
      }))
      .sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
      });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = (e as Error).message ?? 'Failed to load history';
    console.error('[history] list failed', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
