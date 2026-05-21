import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

interface RawAnalysisRow {
  answers?: Record<string, unknown> & { _subs?: string[] };
  subs?: string[];
  [k: string]: unknown;
}

function flattenSubs(row: RawAnalysisRow): Record<string, unknown> {
  const answers = (row.answers ?? {}) as Record<string, unknown> & { _subs?: string[] };
  const subs = answers._subs ?? row.subs ?? [];
  const cleanAnswers = { ...answers };
  delete cleanAnswers._subs;
  return { ...row, answers: cleanAnswers, subs };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const embedToken = req.headers.get('x-embed-token') ?? '';
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  try {
    const row = (await dbGet('analyses', params.id, embedToken)) as RawAnalysisRow;
    return NextResponse.json(flattenSubs(row));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
