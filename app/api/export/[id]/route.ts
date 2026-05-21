import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

interface Problem {
  rank: number;
  title: string;
  description: string;
  format_fit: string;
  viral_lever: string;
  source_urls: string[];
  signal: number;
}

interface Analysis {
  id: string;
  niche: string;
  answers: Record<string, string>;
  subs: string[];
  problems: Problem[];
  raw_post_count: number;
  created_at: string;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const embedToken = req.headers.get('x-embed-token') ?? req.nextUrl.searchParams.get('t') ?? '';
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });

  try {
    const raw = (await dbGet('analyses', params.id, embedToken)) as Analysis & {
      answers?: Record<string, string> & { _subs?: string[] };
    };
    const subs = raw.answers?._subs ?? raw.subs ?? [];
    const cleanAnswers = { ...(raw.answers ?? {}) };
    delete (cleanAnswers as Record<string, unknown>)._subs;
    const a: Analysis = { ...raw, answers: cleanAnswers, subs };
    const md = renderMarkdown(a);
    return new NextResponse(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="painscout-${a.niche.slice(0, 30).replace(/\W+/g, '-')}-${a.id.slice(0, 6)}.md"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

function renderMarkdown(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`# PainScout — ${a.niche}`);
  lines.push('');
  lines.push(`Generated: ${a.created_at}`);
  lines.push(`Subs: ${a.subs.join(', ')}`);
  lines.push(`Raw posts analyzed: ${a.raw_post_count}`);
  lines.push('');
  lines.push('## Context');
  for (const [k, v] of Object.entries(a.answers ?? {})) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push('');
  lines.push('## Top Problems');
  lines.push('');
  for (const p of a.problems ?? []) {
    lines.push(`### ${p.rank}. ${p.title}`);
    lines.push('');
    lines.push(p.description);
    lines.push('');
    lines.push(`- **Format fit:** ${p.format_fit}`);
    lines.push(`- **Viral lever:** ${p.viral_lever}`);
    lines.push(`- **Signal:** ${p.signal}`);
    if (p.source_urls?.length) {
      lines.push(`- **Sources:**`);
      for (const u of p.source_urls) lines.push(`  - ${u}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
