// Shared types used by both server and client code. Defining them here
// prevents client bundles from pulling in server-only fetch logic.

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

export type TimeWindow = 'day' | 'week' | 'month' | 'year' | 'all';

export function timeWindowFromAnswers(answers: Record<string, string>): TimeWindow {
  const s = JSON.stringify(answers).toLowerCase();
  if (s.includes('last 30') || s.includes('hot') || s.includes('30 days')) return 'month';
  if (s.includes('6-12') || s.includes('6 months') || s.includes('year')) return 'year';
  if (s.includes('all-time') || s.includes('all time')) return 'all';
  return 'month';
}
