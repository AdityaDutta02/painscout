import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { topPosts } from '@/lib/score';
import type { ScoredPost } from '@/lib/score';
import type { RedditPost } from '@/lib/types';
import { rankProblems } from '@/lib/llm';
import { dbInsert, dbUpdate } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface AnalysisRow {
  id: string;
  viewer_id: string;
  niche: string;
  answers: Record<string, unknown>;
  status: string;
  problems: unknown[];
  raw_post_count: number;
}

async function runAnalysis(
  id: string,
  niche: string,
  answers: Record<string, string>,
  scored: ScoredPost[],
  rawPostCount: number,
  embedToken: string
): Promise<void> {
  try {
    if (scored.length === 0) {
      await dbUpdate(
        'analyses',
        id,
        { status: 'done', problems: [], raw_post_count: rawPostCount },
        embedToken
      );
      return;
    }

    const problems = await rankProblems(niche, answers, scored, embedToken);
    await dbUpdate(
      'analyses',
      id,
      { status: 'done', problems, raw_post_count: rawPostCount },
      embedToken
    );
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
  const { niche, answers, subs, posts, rawPostCount, embedToken, viewerId } = (await req.json()) as {
    niche?: string;
    answers?: Record<string, string>;
    subs?: string[];
    posts?: RedditPost[];
    rawPostCount?: number;
    embedToken?: string;
    viewerId?: string;
  };

  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  if (!niche || !subs || subs.length === 0) {
    return NextResponse.json({ error: 'niche + subs required' }, { status: 400 });
  }
  if (!posts) {
    return NextResponse.json(
      { error: 'No Reddit posts in payload. Client-side scrape may have failed.' },
      { status: 400 }
    );
  }

  // Score server-side so client never sees PAIN_KEYWORDS (cheaper than
  // shipping the heuristic to the browser bundle, also keeps tweakable
  // scoring server-only).
  const scored = topPosts(posts, 50);

  const vid = viewerId ?? 'anon';
  const id = randomUUID();
  const answersWithSubs = { ...(answers ?? {}), _subs: subs };

  try {
    await dbInsert<AnalysisRow>(
      'analyses',
      {
        id,
        viewer_id: vid,
        niche,
        answers: answersWithSubs,
        status: 'running',
        problems: [],
        raw_post_count: posts.length,
      },
      embedToken
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error('[analyze] insert failed', e);
    return NextResponse.json({ error: `DB insert failed: ${msg}` }, { status: 500 });
  }

  setImmediate(() => {
    void runAnalysis(id, niche, answers ?? {}, scored, rawPostCount ?? posts.length, embedToken);
  });

  return NextResponse.json({ id, status: 'running' });
}
