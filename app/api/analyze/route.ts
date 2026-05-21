import { NextRequest, NextResponse } from 'next/server';
import { fetchManySubs } from '@/lib/reddit';
import { topPosts } from '@/lib/score';
import { rankProblems } from '@/lib/llm';
import { dbInsert, dbUpdate } from '@/lib/db';

export const maxDuration = 300;

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

  // Insert record up front so client can poll if needed
  let row: AnalysisRow;
  try {
    row = await dbInsert<AnalysisRow>(
      'analyses',
      {
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
    console.error('[analyze] insert failed', e);
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
  }

  try {
    const tw = timeWindowFromAnswers(answers ?? {});
    const rawPosts = await fetchManySubs(subs.slice(0, 7), tw, 100);
    const scored = topPosts(rawPosts, 50);

    if (scored.length === 0) {
      await dbUpdate('analyses', row.id, { status: 'done', problems: [], raw_post_count: rawPosts.length }, embedToken);
      return NextResponse.json({
        id: row.id,
        status: 'done',
        problems: [],
        raw_post_count: rawPosts.length,
        note: 'No pain signal found in selected subs. Try different subs or wider time window.',
      });
    }

    const problems = await rankProblems(niche, answers ?? {}, scored, embedToken);

    await dbUpdate(
      'analyses',
      row.id,
      { status: 'done', problems, raw_post_count: rawPosts.length },
      embedToken
    );

    return NextResponse.json({
      id: row.id,
      status: 'done',
      problems,
      raw_post_count: rawPosts.length,
    });
  } catch (e: unknown) {
    const err = e as Error & { code?: string; redirect?: string };
    await dbUpdate('analyses', row.id, { status: 'failed', error: err.message ?? 'Unknown' }, embedToken).catch(() => {});
    if (err.code === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: err.message, code: 'INSUFFICIENT_CREDITS', redirect: err.redirect }, { status: 402 });
    }
    console.error('[analyze] failed', err);
    return NextResponse.json({ error: err.message ?? 'Analysis failed', id: row.id }, { status: 500 });
  }
}
