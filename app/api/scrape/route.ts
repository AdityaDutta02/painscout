import { NextRequest, NextResponse } from 'next/server';
import { fetchManySubs } from '@/lib/reddit';
import type { TimeWindow } from '@/lib/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const embedToken = req.headers.get('x-embed-token') ?? '';
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });

  const { subs, timeWindow, limit } = (await req.json()) as {
    subs?: string[];
    timeWindow?: TimeWindow;
    limit?: number;
  };

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'subs required' }, { status: 400 });
  }

  try {
    const { posts, errors } = await fetchManySubs(
      subs.slice(0, 7),
      timeWindow ?? 'month',
      limit ?? 100,
      embedToken
    );
    return NextResponse.json({ posts, errors });
  } catch (e: unknown) {
    const err = e as Error & { code?: string; redirect?: string };
    console.error('[scrape] failed', err);
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json(
        { error: 'Out of credits', code: 'INSUFFICIENT_CREDITS', redirect: err.redirect },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: err.message ?? 'Scrape failed' }, { status: 500 });
  }
}
