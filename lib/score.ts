// Pre-filter Reddit posts before sending the cluster to the LLM.
// Goal: drop low-signal posts cheaply so the LLM only sees real pain.

import type { RedditPost } from './types';

const PAIN_KEYWORDS = [
  'frustrat', 'struggl', 'stuck', 'hate', 'annoying', 'tired of', 'fed up',
  'how do i', 'how do you', 'how to', 'anyone else', 'best way', 'best practice',
  'advice', 'help', 'rant', 'venting', 'pet peeve', 'worst', 'nightmare',
  'broken', 'doesnt work', "doesn't work", 'failing', 'bug', 'wrong',
  'pushback', 'fight', 'battle', "won't", 'cant figure', "can't figure",
  'no time', 'no budget', 'no idea', 'losing', 'lost',
  'why does', 'why is', 'what is the', 'what works', 'what fits',
  'unpopular opinion', 'controversial', 'change my mind', 'is it just me',
];

export interface ScoredPost extends RedditPost {
  pain_score: number;
  keyword_hits: string[];
}

export function scorePost(p: RedditPost): ScoredPost {
  const text = (p.title + ' ' + p.selftext).toLowerCase();
  const hits = PAIN_KEYWORDS.filter((kw) => text.includes(kw));
  const engagement = p.score + p.comments * 3;
  const pain_score = hits.length === 0 ? 0 : hits.length * engagement;
  return { ...p, pain_score, keyword_hits: hits };
}

export function topPosts(posts: RedditPost[], limit = 60): ScoredPost[] {
  return posts
    .map(scorePost)
    .filter((p) => p.pain_score > 0)
    .sort((a, b) => b.pain_score - a.pain_score)
    .slice(0, limit);
}
