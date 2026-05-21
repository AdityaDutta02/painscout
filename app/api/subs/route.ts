import { NextRequest, NextResponse } from 'next/server';
import { suggestSubs } from '@/lib/llm';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { niche, answers, embedToken } = (await req.json()) as {
    niche?: string;
    answers?: Record<string, string>;
    embedToken?: string;
  };
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  if (!niche) return NextResponse.json({ error: 'Niche required' }, { status: 400 });
  try {
    const subs = await suggestSubs(niche, answers ?? {}, embedToken);
    return NextResponse.json({ subs });
  } catch (e: unknown) {
    const err = e as Error & { code?: string; redirect?: string };
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: err.message, code: 'INSUFFICIENT_CREDITS', redirect: err.redirect }, { status: 402 });
    }
    console.error('[subs]', err);
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 });
  }
}
