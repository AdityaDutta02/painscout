import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { fetchManySubs } from '@/lib/reddit';
import { topPosts } from '@/lib/score';
import { rankProblems } from '@/lib/llm';
import { dbInsert, dbUpdate } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface AnalysisRow {
  id: string;
  viewer_id: string;
  niche: string;
  answers: Record<string, string>;
  subs: string[];
  status: string;
  problems: unknown[];
  raw_post_count: number;
}

function timeWindowFromAnswers(answers: Record<string, string>): 'day' | 'week' | 'month' | 'year' | 'all' {
  const s = JSON.stringify(answers).toLowerCase();
  if (s.includes('last 30') || s.includes('hot') || s.includes('30 days')) return 'month';
  if (s.includes('6-12') || s.includes('6 months') || s.includes('year')) return 'year';
  if (s.includes('all-time') || s.includes('all time')) return 'all';
  return 'month';
}

async function runAnalysis(
  id: string,
  niche: string,
  answers: Record<string, string>,
  subs: string[],
  embedToken: string
): Promise<void> {
  try {
    const tw = timeWindowFromAnswers(answers);
    const rawPosts = await fetchManySubs(subs.slice(0, 7), tw, 100);
    const scored = topPosts(rawPosts, 50);

    if (scored.length === 0) {
      await dbUpdate('analyses', id, { status: 'done', problems: [], raw_post_count: rawPosts.length }, embedToken);
      return;
    }

    const problems = await rankProblems(niche, answers, scored, embedToken);
    await dbUpdate('analyses', id, { status: 'done', problems, raw_post_count: rawPosts.length }, embedToken);
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    console.error('[analyze] background work failed', err);
    await dbUpdate(
      'analyses',
      id,
      { status: 'failed', error: err.message ?? 'Unknown error' },
      embedToken
    ).catch((updateErr) => console.error('[analyze] failed status update also failed', updateErr));
  }
}

export async function POST(req: NextRequest) {
  const { niche, answers, subs, embedToken, viewerId } = (await req.json()) as {
    niche?: string;
    answers?: Record<string, string>;
    subs?: string[];
    embedToken?: string;
    viewerId?: string;
  };

  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  if (!niche || !subs || subs.length === 0) {
    return NextResponse.json({ error: 'niche + subs required' }, { status: 400 });
  }

  const vid = viewerId ?? 'anon';
  const id = randomUUID();

  try {
    await dbInsert<AnalysisRow>(
      'analyses',
      {
        id,
        viewer_id: vid,
        niche,
        answers: answers ?? {},
        subs,
        status: 'running',
        problems: [],
        raw_post_count: 0,
      },
      embedToken
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error('[analyze] insert failed', e);
    return NextResponse.json({ error: `DB insert failed: ${msg}` }, { status: 500 });
  }

  // Detach work — return id immediately so the client can poll /api/analyze/[id].
  // setImmediate ensures the response is flushed before the long task starts.
  setImmediate(() => {
    void runAnalysis(id, niche, answers ?? {}, subs, embedToken);
  });

  return NextResponse.json({ id, status: 'running' });
}
