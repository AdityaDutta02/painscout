// Wrappers around callGateway for: question generation, sub suggestion,
// problem clustering + ranking. JSON-only outputs with retry-on-parse-fail.

import { callGateway } from './terminal-ai';
import type { ScoredPost } from './score';

function extractJson<T>(s: string): T {
  // model often wraps JSON in ```json ... ``` or adds prose
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : s).trim();
  // try direct
  try {
    return JSON.parse(raw) as T;
  } catch {
    // last resort: pull first {...} or [...]
    const obj = raw.match(/[{\[][\s\S]*[}\]]/);
    if (!obj) throw new Error('No JSON found in LLM output');
    return JSON.parse(obj[0]) as T;
  }
}

export interface AIQuestion {
  question: string;
  header: string;
  options: { label: string; description: string }[];
}

export async function generateQuestions(niche: string, embedToken: string): Promise<AIQuestion[]> {
  const system = `You generate 4 multiple-choice questions that refine pain-point research for a content creator working in a given niche.

Always cover these 4 axes (adapt the wording + options to the niche):
1. Audience tier (e.g. beginner / mid / senior / leader — adapt language for the niche)
2. Distribution platform (LinkedIn / Twitter / Instagram-TikTok / YouTube-blog — multi-select OK)
3. Recency window (last 30 days / 6-12 months / all-time)
4. Output mode (ranked list / hooks / full briefs / raw posts)

Each question must have 3-4 options. Each option needs a 1-line label and a 1-line description.

Return ONLY valid JSON matching:
[{"question": "...", "header": "...", "options": [{"label": "...", "description": "..."}]}]

No prose. No code fences.`;

  const res = await callGateway(
    [{ role: 'user', content: `Niche: ${niche}` }],
    embedToken,
    { category: 'chat', tier: 'fast', system }
  );
  return extractJson<AIQuestion[]>(res.content);
}

export async function suggestSubs(niche: string, answers: Record<string, string>, embedToken: string): Promise<string[]> {
  const system = `You suggest 5-7 ACTIVE subreddits where pain-points for the given niche are discussed.

Rules:
- Use real subreddit names (no /r/ prefix, just the name).
- Prefer practitioner subs over general discussion subs.
- Bias toward subs where mid-senior practitioners post.

Return ONLY valid JSON: ["sub1", "sub2", ...]
No prose. No code fences.`;
  const userMsg = `Niche: ${niche}\nAudience + platform context: ${JSON.stringify(answers)}`;
  const res = await callGateway([{ role: 'user', content: userMsg }], embedToken, {
    category: 'chat',
    tier: 'fast',
    system,
  });
  return extractJson<string[]>(res.content);
}

export interface RankedProblem {
  rank: number;
  title: string;
  description: string;
  format_fit: string;
  viral_lever: string;
  source_urls: string[];
  signal: number;
}

export async function rankProblems(
  niche: string,
  answers: Record<string, string>,
  posts: ScoredPost[],
  embedToken: string
): Promise<RankedProblem[]> {
  // Keep prompt size sane — cap at 50 posts, trim selftext
  const trimmed = posts.slice(0, 50).map((p, i) => ({
    i,
    sub: p.sub,
    title: p.title,
    body: p.selftext.slice(0, 500),
    score: p.score,
    comments: p.comments,
    url: p.url,
  }));

  const system = `You analyze Reddit posts and produce ranked problem-statements that a content creator can turn into viral reels/carousels.

Inputs: a niche, the creator's audience+platform context, and ~50 top Reddit posts (with index, sub, title, body excerpt, engagement, url).

Your job:
1. Cluster posts into 10-15 distinct PROBLEMS (not posts — themes). Merge near-duplicates.
2. For each problem, write:
   - "title": one tight line describing the problem
   - "description": 2-3 sentences with the specific pain and a tactical content angle
   - "format_fit": which content format works best — "reel teardown", "carousel checklist", "pattern comparison", "tactical tip", "data-backed contrarian"
   - "viral_lever": 1 sentence — why this will get saves/shares
   - "source_urls": array of the most relevant 1-3 source post URLs
   - "signal": integer 1-100 (engagement * specificity * save-worthiness)
3. Sort by "signal" desc and assign "rank" starting at 1.
4. Return TOP 10 problems only.

Return ONLY valid JSON: [{"rank":1, "title":"...", "description":"...", "format_fit":"...", "viral_lever":"...", "source_urls":["..."], "signal":83}, ...]
No prose. No code fences.`;

  const userMsg = `Niche: ${niche}
Audience + platform context: ${JSON.stringify(answers)}

Posts (JSON):
${JSON.stringify(trimmed)}`;

  const res = await callGateway([{ role: 'user', content: userMsg }], embedToken, {
    category: 'chat',
    tier: 'good',
    system,
  });
  return extractJson<RankedProblem[]>(res.content);
}
