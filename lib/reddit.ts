// Fetch top posts from a subreddit via Reddit's public JSON endpoint.
// No auth. Polite UA + throttle. Personal-use disclaimer in app footer.

export interface RedditPost {
  sub: string;
  title: string;
  selftext: string;
  score: number;
  comments: number;
  url: string;
  flair: string;
  created: number;
}

const UA = 'web:painscout:0.1 (research)';

export async function fetchSub(sub: string, timeWindow: 'day' | 'week' | 'month' | 'year' | 'all' = 'month', limit = 100): Promise<RedditPost[]> {
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

export async function fetchManySubs(subs: string[], timeWindow: 'day' | 'week' | 'month' | 'year' | 'all' = 'month', limit = 100): Promise<RedditPost[]> {
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
