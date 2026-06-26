// Terminal AI gateway scrape SDK (server-side only).
// Reddit-only surface for PainScout. Start job → poll until done.

function gatewayUrl(): string {
  const url = process.env.TERMINAL_AI_GATEWAY_URL;
  if (!url) throw new Error('TERMINAL_AI_GATEWAY_URL is not set');
  return url;
}

const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 80_000;

export interface ScrapeEnvelope<T> {
  data: T;
  credits_charged: number;
}

interface StartResponse {
  jobId?: string;
  status?: 'running' | 'done' | 'error';
  data?: unknown;
  credits_charged?: number;
  error?: string;
}

interface PollResponse {
  status: 'running' | 'done' | 'error';
  data?: unknown;
  credits_charged?: number;
  error?: string;
}

type ScrapeError = Error & { code?: string; status?: number; retryable?: boolean };

function scrapeError(message: string, extra: Partial<ScrapeError> = {}): ScrapeError {
  return Object.assign(new Error(message), extra);
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? res.statusText;
}

async function startJob(
  platform: string,
  body: Record<string, unknown>,
  token: string
): Promise<StartResponse> {
  const res = await fetch(`${gatewayUrl()}/v1/scrape/${platform}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    const b = (await res.json().catch(() => ({}))) as { redirect?: string };
    throw scrapeError('Insufficient credits', {
      code: 'INSUFFICIENT_CREDITS',
      status: 402,
      retryable: false,
      ...b,
    });
  }
  if (res.status === 403) {
    throw scrapeError('Scrape forbidden (owner-only)', {
      code: 'SCRAPE_FORBIDDEN',
      status: 403,
      retryable: false,
    });
  }
  if (!res.ok) {
    throw scrapeError(`scrape start failed (${res.status}): ${await readError(res)}`, {
      status: res.status,
    });
  }
  return res.json() as Promise<StartResponse>;
}

async function pollJob(jobId: string, token: string): Promise<PollResponse> {
  const res = await fetch(`${gatewayUrl()}/v1/scrape/result/${jobId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok)
    throw scrapeError(`scrape poll failed (${res.status}): ${await readError(res)}`, {
      status: res.status,
    });
  return res.json() as Promise<PollResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function scrape<T>(
  platform: string,
  operation: string,
  params: Record<string, unknown>,
  token: string
): Promise<ScrapeEnvelope<T>> {
  if (!token) throw scrapeError('Missing token', { code: 'NO_TOKEN', retryable: false });
  const started = await startJob(platform, { operation, ...params }, token);

  if (started.status === 'done' && started.data !== undefined) {
    return { data: started.data as T, credits_charged: started.credits_charged ?? 0 };
  }
  if (started.status === 'error') throw scrapeError(started.error ?? 'scrape failed');
  if (!started.jobId) throw scrapeError('scrape start returned no jobId and no data');

  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const r = await pollJob(started.jobId, token);
    if (r.status === 'done')
      return { data: r.data as T, credits_charged: r.credits_charged ?? 0 };
    if (r.status === 'error') throw scrapeError(r.error ?? 'scrape failed');
  }
  throw scrapeError(`scrape timed out after ${POLL_DEADLINE_MS}ms (${platform}:${operation})`, {
    code: 'SCRAPE_TIMEOUT',
  });
}

export interface RedditListingParams {
  sort?: 'hot' | 'new' | 'top';
  t?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
}

export const reddit = {
  listing: <T = unknown>(subreddit: string, opts: RedditListingParams, token: string) =>
    scrape<T>(
      'reddit',
      'listing',
      { subreddit, sort: opts.sort ?? 'top', t: opts.t ?? 'month', limit: opts.limit ?? 100 },
      token
    ),
};
