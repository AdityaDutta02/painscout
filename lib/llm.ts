// Wrappers around callGateway for: question generation, sub suggestion,
// problem clustering + ranking. JSON-only outputs with retry-on-parse-fail.

import { callGateway } from './terminal-ai';
import type { ScoredPost } from './score';

interface GatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GatewayOpts {
  category: string;
  tier: string;
  system: string;
}

function extractJson<T>(s: string): T {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : s).trim();

  try {
    return JSON.parse(raw) as T;
  } catch {}

  const start = raw.search(/[{[]/);
  if (start === -1) throw new Error(`No JSON found. First 200: ${raw.slice(0, 200)}`);
  const body = raw.slice(start);

  // Brute-force: walk back from end, retry parse at each closing bracket.
  for (let end = body.length; end > 1; end--) {
    const ch = body[end - 1];
    if (ch !== ']' && ch !== '}') continue;
    try {
      return JSON.parse(body.slice(0, end)) as T;
    } catch {}
  }

  // Last resort: close any open brackets at end of body.
  const repaired = repairBrackets(body);
  try {
    return JSON.parse(repaired) as T;
  } catch (e) {
    throw new Error(`JSON parse failed (${(e as Error).message}). First 200: ${raw.slice(0, 200)}`);
  }
}

function repairBrackets(s: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' && stack[stack.length - 1] === '{') stack.pop();
    else if (c === ']' && stack[stack.length - 1] === '[') stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  while (stack.length) {
    const top = stack.pop();
    out += top === '{' ? '}' : ']';
  }
  return out;
}

async function callJson<T>(messages: GatewayMessage[], embedToken: string, opts: GatewayOpts): Promise<T> {
  const res = await callGateway(messages, embedToken, opts);
  try {
    return extractJson<T>(res.content);
  } catch (firstErr) {
    console.warn('[llm] first JSON parse failed, retrying with stricter prompt', (firstErr as Error).message);
    const stricter: GatewayOpts = {
      ...opts,
      system: `${opts.system}\n\nCRITICAL: Your previous response was malformed JSON. Return ONLY a complete, valid JSON value. No markdown fences. No prose. No trailing commentary. Escape all quotes inside strings.`,
    };
    const retry = await callGateway(messages, embedToken, stricter);
    return extractJson<T>(retry.content);
  }
}

export interface AIQuestion {
  question: string;
  header: string;
  options: { label: string; description: string }[];
}

export async function generateQuestions(niche: string, embedToken: string): Promise<AIQuestion[]> {
  const system = `You generate 4 multiple-choice questions for a CONTENT CREATOR who PUBLISHES content in a given niche. They are the creator/publisher, NOT a consumer or researcher. Every question must reference what THEY create, target, or publish — never what they read, follow, or watch.

Always cover these 4 axes, in this order. Adapt wording + options to the niche but keep the creator-side framing strict:

1. AUDIENCE TIER they create for. Who is the viewer of their content? (e.g. juniors learning the niche / mid-level practitioners / senior leaders / decision-makers). Frame as "Who do you create for?", not "Who do you follow?".

2. PUBLISH PLATFORM where they post their content (e.g. Instagram + TikTok reels / LinkedIn carousels / Twitter threads / YouTube long-form / blog + newsletter). Frame as "Where do you POST?", NEVER "Where do you read/consume content?".

3. RECENCY WINDOW for the source pain to scrape (last 30 days = trend-chasing / 6-12 months = evergreen / all-time = foundational). Frame as "How fresh should the pain signal be?".

4. OUTPUT MODE they want from this tool (ranked problem list / hooks only / full content briefs / raw quotes). Frame as "What do you want from this report?".

Each question MUST have 3-4 options. Each option needs a 1-line label and a 1-line description.

ANTI-EXAMPLES — never produce questions like:
- "Where do you consume content?" (BAD — consumer framing)
- "What design tools do you use?" (BAD — not on the 4 axes)
- "What's your favorite UX blog?" (BAD — research framing)
- "How experienced are you in design?" (BAD — about the creator's skill, not their audience)

GOOD examples:
- "Where do you publish content?" (audience PLATFORM, creator framing)
- "Who is your target viewer's career stage?" (audience TIER, creator framing)

Return ONLY valid JSON matching:
[{"question": "...", "header": "...", "options": [{"label": "...", "description": "..."}]}]

No prose. No code fences.`;

  return callJson<AIQuestion[]>(
    [{ role: 'user', content: `Niche: ${niche}` }],
    embedToken,
    { category: 'chat', tier: 'fast', system }
  );
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
  return callJson<string[]>([{ role: 'user', content: userMsg }], embedToken, {
    category: 'chat',
    tier: 'fast',
    system,
  });
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

  return callJson<RankedProblem[]>([{ role: 'user', content: userMsg }], embedToken, {
    category: 'chat',
    tier: 'good',
    system,
  });
}
