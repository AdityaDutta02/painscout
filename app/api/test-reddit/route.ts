import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UA_VARIANTS = [
  'web:painscout:0.1 (research)',
  'node:painscout:0.1 (by /u/AdityaDutta02)',
  'painscout/0.1.0 (Linux; by /u/AdityaDutta02)',
  'Mozilla/5.0 (compatible; PainScoutBot/0.1; +https://painscout-mjxy4.apps.terminalai.studioionique.com)',
];

const URLS_FOR = (sub: string) => [
  `https://www.reddit.com/r/${sub}/top.json?t=month&limit=10`,
  `https://old.reddit.com/r/${sub}/top.json?t=month&limit=10`,
  `https://api.reddit.com/r/${sub}/top.json?t=month&limit=10`,
];

interface Probe {
  ua: string;
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  bodySample: string;
  childrenCount: number | null;
  error?: string;
}

export async function GET(req: NextRequest) {
  const sub = req.nextUrl.searchParams.get('sub') ?? 'UXDesign';
  const probes: Probe[] = [];

  for (const ua of UA_VARIANTS) {
    for (const url of URLS_FOR(sub)) {
      const probe: Probe = {
        ua,
        url,
        status: 0,
        ok: false,
        contentType: '',
        bodySample: '',
        childrenCount: null,
      };
      try {
        const res = await fetch(url, { headers: { 'User-Agent': ua }, cache: 'no-store' });
        probe.status = res.status;
        probe.ok = res.ok;
        probe.contentType = res.headers.get('content-type') ?? '';
        const text = await res.text();
        probe.bodySample = text.slice(0, 300);
        try {
          const parsed = JSON.parse(text) as { data?: { children?: unknown[] } };
          probe.childrenCount = parsed.data?.children?.length ?? null;
        } catch {
          probe.childrenCount = null;
        }
      } catch (e) {
        probe.error = (e as Error).message;
      }
      probes.push(probe);
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return NextResponse.json({ sub, probes });
}
