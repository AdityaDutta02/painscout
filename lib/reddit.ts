// SERVER-SIDE Reddit fetch — kept as a fallback. Reddit blocks the
// Coolify datacenter IP, so the primary path is client-side fetch via
// lib/reddit-client.ts. This file is only used if the client did not
// supply pre-scraped posts in the analyze payload.

import type { RedditPost, TimeWindow } from './types';

export type { RedditPost };

const UA = 'web:painscout:0.1 (research)';

export async function fetchSub(sub: string, timeWindow: TimeWindow = 'month', limit = 100): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?t=${timeWindow}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error(`Rate limited on r/${sub}. Try again in a moment.`);
    if (res.status === 404 || res.status === 403) return [];
    throw new Error(`Reddit fetch failed for r/${sub}: ${res.status}`);
  }
  const data = (await res.json()) as { data?: { children?: Array<{ data: Record<string, unknown> }> } };
  const children = data.data?.children ?? [];
  return children.map((c) => {
    const d = c.data;
    return {
      sub,
      title: (d.title as string) ?? '',
      selftext: (d.selftext as string) ?? '',
      score: (d.score as number) ?? 0,
      comments: (d.num_comments as number) ?? 0,
      url: 'https://reddit.com' + ((d.permalink as string) ?? ''),
      flair: (d.link_flair_text as string) ?? '',
      created: (d.created_utc as number) ?? 0,
    } satisfies RedditPost;
  });
}

export async function fetchManySubs(subs: string[], timeWindow: TimeWindow = 'month', limit = 100): Promise<RedditPost[]> {
  const out: RedditPost[] = [];
  for (const sub of subs) {
    try {
      const posts = await fetchSub(sub, timeWindow, limit);
      out.push(...posts);
    } catch (err) {
      console.warn(`[reddit] skipped r/${sub}:`, err);
    }
    // polite delay between subs
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}
