import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { dbList, dbInsert } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ProbeResult {
  step: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

async function probe<T>(step: string, fn: () => Promise<T>): Promise<ProbeResult> {
  try {
    const result = await fn();
    return { step, ok: true, result };
  } catch (e) {
    return { step, ok: false, error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const { embedToken } = (await req.json()) as { embedToken?: string };
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });

  const results: ProbeResult[] = [];

  // 1. Does the table exist? List returns 200 + [] if table is empty but exists.
  results.push(await probe('list_analyses', () => dbList('analyses', {}, embedToken)));

  // 2. Bare-minimum insert — only the NOT NULL fields without defaults.
  results.push(
    await probe('insert_minimum', () =>
      dbInsert('analyses', { viewer_id: 'diag', niche: 'diag-min' }, embedToken)
    )
  );

  // 3. Insert with explicit id (UUID).
  results.push(
    await probe('insert_with_id', () =>
      dbInsert('analyses', { id: randomUUID(), viewer_id: 'diag', niche: 'diag-id' }, embedToken)
    )
  );

  // 4. Insert with empty JSONB.
  results.push(
    await probe('insert_with_jsonb', () =>
      dbInsert(
        'analyses',
        { viewer_id: 'diag', niche: 'diag-jsonb', answers: {}, problems: [] },
        embedToken
      )
    )
  );

  // 5. Insert with TEXT[] array.
  results.push(
    await probe('insert_with_array', () =>
      dbInsert(
        'analyses',
        { viewer_id: 'diag', niche: 'diag-array', subs: ['UXDesign', 'ProductDesign'] },
        embedToken
      )
    )
  );

  // 6. Full payload — matches what /api/analyze sends.
  results.push(
    await probe('insert_full', () =>
      dbInsert(
        'analyses',
        {
          id: randomUUID(),
          viewer_id: 'diag',
          niche: 'diag-full',
          answers: { q1: 'a' },
          subs: ['UXDesign'],
          status: 'running',
          problems: [],
          raw_post_count: 0,
        },
        embedToken
      )
    )
  );

  return NextResponse.json({ results });
}
