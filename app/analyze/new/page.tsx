'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEmbedToken } from '@/hooks/use-embed-token';
import { fetchManySubsBrowser } from '@/lib/reddit-client';
import { timeWindowFromAnswers } from '@/lib/types';
import type { SubFetchResult } from '@/lib/reddit-client';

interface AIQuestion {
  question: string;
  header: string;
  options: { label: string; description: string }[];
}

type Stage =
  | 'loading-questions'
  | 'answering'
  | 'loading-subs'
  | 'approving-subs'
  | 'scraping'
  | 'analyzing'
  | 'error';

interface ScrapeProgress {
  current: number;
  total: number;
  sub: string;
}

export default function NewAnalysis() {
  const router = useRouter();
  const embedToken = useEmbedToken();
  const [niche, setNiche] = useState('');
  const [stage, setStage] = useState<Stage>('loading-questions');
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<string[]>([]);
  const [subInput, setSubInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);
  const [scrapeErrors, setScrapeErrors] = useState<SubFetchResult[]>([]);

  // Pick up niche from session
  useEffect(() => {
    const n = sessionStorage.getItem('painscout:niche') ?? '';
    if (!n) {
      router.push('/');
      return;
    }
    setNiche(n);
  }, [router]);

  // Fetch AI questions
  useEffect(() => {
    if (!niche || !embedToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ niche, embedToken }),
        });
        const data = (await res.json()) as { questions?: AIQuestion[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.questions) {
          setErrorMsg(data.error ?? 'Failed to generate questions');
          setStage('error');
          return;
        }
        setQuestions(data.questions);
        setStage('answering');
      } catch (e) {
        if (cancelled) return;
        setErrorMsg((e as Error).message);
        setStage('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [niche, embedToken]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.header]);

  async function loadSubs() {
    if (!embedToken) return;
    setStage('loading-subs');
    try {
      const res = await fetch('/api/subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, answers, embedToken }),
      });
      const data = (await res.json()) as { subs?: string[]; error?: string };
      if (!res.ok || !data.subs) {
        setErrorMsg(data.error ?? 'Failed to suggest subs');
        setStage('error');
        return;
      }
      setSubs(data.subs);
      setStage('approving-subs');
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStage('error');
    }
  }

  async function runAnalysis() {
    if (!embedToken) return;
    setStage('scraping');
    setScrapeProgress({ current: 0, total: subs.length, sub: '' });
    setScrapeErrors([]);

    const timeWindow = timeWindowFromAnswers(answers);

    let scraped;
    try {
      scraped = await fetchManySubsBrowser(subs.slice(0, 7), timeWindow, 100, (current, total, sub) =>
        setScrapeProgress({ current, total, sub })
      );
    } catch (e) {
      setErrorMsg(`Reddit scrape failed: ${(e as Error).message}`);
      setStage('error');
      return;
    }
    setScrapeErrors(scraped.errors);

    if (scraped.posts.length === 0) {
      const errLines = scraped.errors.map((er) => `r/${er.sub}: ${er.error ?? 'no posts'}`).join('\n');
      setErrorMsg(
        `Reddit returned no posts.\n${errLines || 'All subs returned empty.'}\nReddit may be rate-limiting your IP — wait a few minutes and try again.`
      );
      setStage('error');
      return;
    }

    setStage('analyzing');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          answers,
          subs,
          posts: scraped.posts,
          rawPostCount: scraped.posts.length,
          embedToken,
          viewerId: 'viewer',
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setErrorMsg(data.error ?? 'Analysis failed');
        setStage('error');
        return;
      }
      router.push(`/analyze/${data.id}`);
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStage('error');
    }
  }

  function addSubFromInput() {
    const s = subInput.trim().replace(/^r\//i, '').replace(/^\//, '');
    if (!s) return;
    if (subs.includes(s)) return;
    setSubs([...subs, s]);
    setSubInput('');
  }

  if (stage === 'loading-questions') {
    return <Status text="Reading your niche and crafting questions…" niche={niche} />;
  }

  if (stage === 'error') {
    return (
      <div className="card max-w-2xl space-y-3">
        <div className="text-lg font-medium">Something went wrong</div>
        <pre className="text-sm text-neutral-700 whitespace-pre-wrap break-words">{errorMsg}</pre>
        <button className="btn-secondary" onClick={() => router.push('/')}>
          Start over
        </button>
      </div>
    );
  }

  if (stage === 'scraping') {
    return (
      <div className="card max-w-2xl space-y-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{niche}</div>
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-accent animate-pulse" />
          <div className="text-sm">
            Scraping Reddit from your browser — {scrapeProgress?.current ?? 0} / {scrapeProgress?.total ?? subs.length}
            {scrapeProgress?.sub ? ` · r/${scrapeProgress.sub}` : ''}
          </div>
        </div>
        <div className="text-xs text-neutral-500">
          Reddit blocks our server IP. Fetching from your browser instead. ~1.5s per sub.
        </div>
        {scrapeErrors.length > 0 && (
          <div className="text-xs text-amber-700">
            Some subs failed: {scrapeErrors.map((e) => `r/${e.sub}`).join(', ')}
          </div>
        )}
      </div>
    );
  }

  if (stage === 'answering') {
    return (
      <div className="space-y-6">
        <Header niche={niche} step={1} />
        {questions.map((q) => (
          <div key={q.header} className="card space-y-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{q.header}</div>
            <div className="font-medium">{q.question}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.header] === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setAnswers({ ...answers, [q.header]: opt.label })}
                    className={`text-left p-3 rounded-md border transition-colors ${
                      selected ? 'border-ink bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-neutral-600 mt-1">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn-primary" disabled={!allAnswered} onClick={loadSubs}>
          Suggest subreddits →
        </button>
      </div>
    );
  }

  if (stage === 'loading-subs') {
    return <Status text="Finding the right subreddits for this niche…" niche={niche} />;
  }

  if (stage === 'approving-subs') {
    return (
      <div className="space-y-6">
        <Header niche={niche} step={2} />
        <div className="card space-y-3">
          <div className="font-medium">Approve subreddits to scrape</div>
          <div className="text-sm text-neutral-600">
            AI suggested these. Remove the bad ones. Add more if you know better subs.
          </div>
          <div className="flex flex-wrap gap-2">
            {subs.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 bg-neutral-100 border border-neutral-300 rounded-full px-3 py-1 text-sm">
                r/{s}
                <button onClick={() => setSubs(subs.filter((x) => x !== s))} aria-label={`remove r/${s}`} className="text-neutral-500 hover:text-ink">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubFromInput())}
              placeholder="Add a sub (e.g. UXDesign)"
              className="input"
            />
            <button className="btn-secondary" onClick={addSubFromInput}>
              Add
            </button>
          </div>
        </div>
        <button className="btn-primary" disabled={subs.length === 0} onClick={runAnalysis}>
          Scrape + rank pain ({subs.length} subs) →
        </button>
      </div>
    );
  }

  if (stage === 'analyzing') {
    return <Status text="Scraping Reddit, scoring posts, clustering pain. ~60-90s." niche={niche} />;
  }

  return null;
}

function Header({ niche, step }: { niche: string; step: number }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-neutral-500">Step {step} of 3</div>
      <div className="text-2xl font-semibold">{niche}</div>
    </div>
  );
}

function Status({ text, niche }: { text: string; niche: string }) {
  return (
    <div className="card max-w-2xl space-y-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{niche}</div>
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-accent animate-pulse" />
        <div className="text-sm">{text}</div>
      </div>
    </div>
  );
}
