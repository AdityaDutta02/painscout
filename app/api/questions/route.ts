import { NextRequest, NextResponse } from 'next/server';
import { generateQuestions } from '@/lib/llm';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { niche, embedToken } = (await req.json()) as { niche?: string; embedToken?: string };
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  if (!niche || niche.trim().length < 2) return NextResponse.json({ error: 'Niche too short' }, { status: 400 });

  try {
    const questions = await generateQuestions(niche.trim(), embedToken);
    return NextResponse.json({ questions });
  } catch (e: unknown) {
    const err = e as Error & { code?: string; redirect?: string };
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: err.message, code: 'INSUFFICIENT_CREDITS', redirect: err.redirect }, { status: 402 });
    }
    if (err.code === 'TOKEN_EXPIRED') {
      return NextResponse.json({ error: err.message, code: 'TOKEN_EXPIRED' }, { status: 401 });
    }
    console.error('[questions]', err);
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 });
  }
}
