// Server-side Reddit fetch via Terminal AI gateway scrape SDK.
// Gateway handles backend rotation, residential IPs, and rate limits.
// Flat 3 credits/call (1 on cache hit) billed to app owner.

import type { RedditPost, TimeWindow } from './types';
import { reddit as redditScrape } from './scrape-sdk';

export type { RedditPost };

export interface SubFetchResult {
  sub: string;
  posts: RedditPost[];
  error?: string;
}

interface RedditChild {
  data: Record<string, unknown>;
}

interface RedditListingData {
  // Raw Reddit shape: { children: [{ data: {...} }] }
  children?: RedditChild[];
  // Possible normalized shape: { items: [...] }
  items?: Array<Record<string, unknown>>;
  // Or wrapped: { data: { children: [...] } }
  data?: { children?: RedditChild[] };
}

function pickField<T>(d: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (d[k] !== undefined && d[k] !== null) return d[k] as T;
  }
  return undefined;
}

function normalizeChild(sub: string, d: Record<string, unknown>): RedditPost {
  const permalink = pickField<string>(d, 'permalink', 'url') ?? '';
  const fullUrl = permalink.startsWith('http')
    ? permalink
    : `https://reddit.com${permalink}`;
  return {
    sub,
    title: pickField<string>(d, 'title') ?? '',
    selftext: pickField<string>(d, 'selftext', 'text', 'body') ?? '',
    score: pickField<number>(d, 'score', 'ups', 'likes') ?? 0,
    comments: pickField<number>(d, 'num_comments', 'comments') ?? 0,
    url: fullUrl,
    flair: pickField<string>(d, 'link_flair_text', 'flair') ?? '',
    created: pickField<number>(d, 'created_utc', 'created') ?? 0,
  };
}

export async function fetchSub(
  sub: string,
  timeWindow: TimeWindow = 'month',
  limit = 100,
  embedToken = ''
): Promise<RedditPost[]> {
  const { data } = await redditScrape.listing<RedditListingData>(
    sub,
    { sort: 'top', t: timeWindow, limit },
    embedToken
  );
  const children = data.children ?? data.data?.children ?? [];
  if (children.length > 0) {
    return children.map((c) => normalizeChild(sub, c.data));
  }
  const items = data.items ?? [];
  return items.map((d) => normalizeChild(sub, d));
}

export async function fetchManySubs(
  subs: string[],
  timeWindow: TimeWindow,
  limit: number,
  embedToken: string,
  onProgress?: (current: number, total: number, sub: string) => void
): Promise<{ posts: RedditPost[]; errors: SubFetchResult[] }> {
  const posts: RedditPost[] = [];
  const errors: SubFetchResult[] = [];
  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    onProgress?.(i + 1, subs.length, sub);
    try {
      const subPosts = await fetchSub(sub, timeWindow, limit, embedToken);
      posts.push(...subPosts);
    } catch (e) {
      errors.push({ sub, posts: [], error: (e as Error).message });
      console.warn(`[reddit] skipped r/${sub}:`, e);
    }
  }
  return { posts, errors };
}
