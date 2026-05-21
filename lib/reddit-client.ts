// Browser-side Reddit fetch. Used because Reddit blocks the Coolify
// datacenter IP. The viewer's browser uses a residential IP that Reddit
// still serves anonymous JSON to.

import type { RedditPost, TimeWindow } from './types';

export interface SubFetchResult {
  sub: string;
  posts: RedditPost[];
  error?: string;
}

export async function fetchSubBrowser(
  sub: string,
  timeWindow: TimeWindow = 'month',
  limit = 100
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?t=${timeWindow}&limit=${limit}`;
  // No UA header — browser sets its own. Including 'credentials: omit' so
  // Reddit treats this as an anonymous GET, not a logged-in user request.
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    if (res.status === 429) throw new Error(`Rate limited on r/${sub}. Wait a minute.`);
    if (res.status === 404 || res.status === 403) return [];
    throw new Error(`Reddit r/${sub} → ${res.status}`);
  }
  const data = (await res.json()) as {
    data?: { children?: Array<{ data: Record<string, unknown> }> };
  };
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

export async function fetchManySubsBrowser(
  subs: string[],
  timeWindow: TimeWindow,
  limit: number,
  onProgress?: (current: number, total: number, sub: string) => void
): Promise<{ posts: RedditPost[]; errors: SubFetchResult[] }> {
  const posts: RedditPost[] = [];
  const errors: SubFetchResult[] = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    onProgress?.(i + 1, subs.length, sub);
    try {
      const result = await fetchSubBrowser(sub, timeWindow, limit);
      posts.push(...result);
    } catch (e) {
      errors.push({ sub, posts: [], error: (e as Error).message });
    }
    if (i < subs.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return { posts, errors };
}
