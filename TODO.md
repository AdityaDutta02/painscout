# PainScout — TODO

MVP shipped 2026-05-21. URL: https://painscout-mjxy4.apps.terminalai.studioionique.com

---

## V2 — Core feature gaps

### 1. Channel-context filter
**Problem:** Generic pain points don't match a creator's voice/umbrella. Figrd needs different problems than a generic UX channel.
**Solution:** Wizard step 0 (optional) — paste 3-5 existing scripts/posts. LLM extracts content DNA (format, tone, topics, anti-topics). Ranker filters problems off-brand.
**Why:** Killer differentiator vs generic Reddit scrapers (GummySearch, Pikr).
**Effort:** ~4-6h.
**Touches:** new step in `app/analyze/new/page.tsx`, `lib/llm.ts` (add `extractChannelDNA` + pass DNA into `rankProblems`), `analyses` table → add `channel_dna JSONB` column.

### 2. Full brief generation per problem
**Problem:** Ranked list is good. Ready-to-shoot scripts are 10x better.
**Solution:** Click-to-generate brief — reel script (30-60s), carousel slides, Twitter thread, YouTube outline. Gated behind explicit click to control LLM cost.
**Why:** Highest user value. Validates Figr-tool tie-in for the channel.
**Effort:** ~6-8h.
**Touches:** new endpoint `POST /api/brief/[problem_id]`, results page → "Generate brief" button per row, new `briefs` table, brief viewer modal/panel.

### 3. Weekly cron + new-problem diff
**Problem:** Pain points decay fast. Manual re-runs miss fresh signal.
**Solution:** "Watch this niche" toggle on results page → registers cron task via `task-sdk`. Weekly re-scrape, mark `is_new=true` for problems not seen in prior 30 days, email digest of new ones only.
**Why:** Solves "what do I post this week" forever. Recurring engagement.
**Effort:** ~6-8h.
**Touches:** new `watches` table, `app/api/cron/run-watches/route.ts` callback, email template via `lib/email-sdk.ts`, "Watch" UI on results page.

### 4. History UI
**Problem:** Past analyses sit in DB with no view. Users can't return to old reports.
**Solution:** `/history` page → list of past analyses for current viewer (newest first), click to re-open.
**Why:** Already 80% done — data exists, just needs the page.
**Effort:** ~1-2h.
**Touches:** new `app/history/page.tsx`, list endpoint already exists (`dbList('analyses', { viewer_id })`).

---

## V2 — Quality + reliability

### 5. Background task pattern
**Problem:** Analyze is sync, ~60-90s. Bad on flaky networks. Browser tab close = lost result.
**Solution:** Convert `/api/analyze` to enqueue → return `id` immediately → status polled via existing `/api/analyze/[id]`. Use `task-sdk` for the actual work.
**Why:** Production reliability. Enables long-running multi-sub scrapes.
**Effort:** ~4h.
**Touches:** `app/api/analyze/route.ts`, new `app/api/internal/run-analysis/route.ts` task callback.

### 6. Raw post storage for re-ranking
**Problem:** Re-running an analysis costs another full Reddit scrape + LLM call.
**Solution:** Cache raw Reddit JSON in `lib/storage.ts` per-analysis. 24h TTL. Re-runs within window skip the scrape.
**Why:** Speed + cost. Enables iteration ("try with these subs added").
**Effort:** ~2h.
**Touches:** `lib/reddit.ts`, `app/api/analyze/route.ts`.

### 7. Robust LLM JSON parsing
**Problem:** Current `extractJson` works most times but can fail on edge cases (nested fences, trailing commentary).
**Solution:** Add 1 retry with stricter system prompt ("Return JSON only, no prose, no fences") on parse failure.
**Why:** Single point of failure right now.
**Effort:** ~1h.
**Touches:** `lib/llm.ts`.

### 8. Reddit fallback when sub returns nothing
**Problem:** AI sometimes suggests a sub that 404s or has no recent activity. We silently skip it.
**Solution:** Detect zero-post subs, surface back to wizard with "couldn't find posts in r/X — replace?" UI.
**Why:** Better UX than silent failure.
**Effort:** ~2h.
**Touches:** `lib/reddit.ts`, wizard.

---

## V3 — Expansion

### 9. Multi-source scraping
**Idea:** Beyond Reddit — Hacker News, Indie Hackers, Product Hunt comments, Twitter advanced search.
**Why:** Different sources surface different pain types (HN = technical, IH = founder, PH = product).
**Effort:** ~1-2d per source.

### 10. Trend tracking
**Idea:** Track problem signal over weeks. "This pain is up 40% MoM." Surfacing emerging vs declining topics.
**Why:** Recency is content gold. First-to-cover wins.
**Effort:** ~1-2d.

### 11. Competitor content gap
**Idea:** Paste competitor channel URL → scrape their posts → compare against pain map → "they haven't covered these 5 problems your audience is begging for."
**Why:** Strategic content gap analysis. High-value.
**Effort:** ~2d.

### 12. Direct-to-script in channel voice
**Idea:** Upload existing scripts → fine-tune prompt → briefs come out *already in the channel's voice* (Figrd-style, Aditya-style, etc).
**Why:** Skip the rewrite step entirely.
**Effort:** ~1d.

### 13. Team accounts + shared analyses
**Idea:** Multiple viewers (writers, editors) on one channel share analyses + briefs.
**Why:** Agencies + multi-person content teams.
**Effort:** ~2d. Needs `viewer_id` → `team_id` model.

---

## Polish backlog

- [ ] Empty state for `/` when viewer has past analyses (show recent)
- [ ] Skeleton loaders instead of plain "Loading…" text
- [ ] Copy-to-clipboard per problem (just the title + description)
- [ ] Dark mode (tokens already in tailwind config)
- [ ] Mobile responsive audit (wizard probably cramped on small screens)
- [ ] Question regeneration ("these don't fit — try again")
- [ ] Sub validation against actual Reddit (verify exists + has activity before submit)
- [ ] Time-window selector explicit in UI (currently inferred from answer text — brittle)
- [ ] Per-problem "save" toggle (favorite)
- [ ] Share link for results page (read-only, no embed token needed)

---

## Tech debt

- [ ] `lib/llm.ts` system prompts hardcoded — move to `lib/prompts.ts` for easier iteration
- [ ] No structured logging. Add a simple logger that calls `console.log` with JSON for prod observability
- [ ] No tests. At minimum unit tests for `scorePost`, `extractJson`, `timeWindowFromAnswers`
- [ ] `viewerId: 'viewer'` is hardcoded client-side — should come from embed token claims server-side
- [ ] `maxDuration` on analyze route is 300s but Reddit + 2 LLM calls might exceed if a sub is slow; need real timeout + partial-result handling
- [ ] Error states use plain text — replace with toast or banner component
- [ ] No analytics — don't know which niches users try, which fail

---

## Priority order if doing v2 this week

1. **#4 History UI** (1-2h, unblocks revisiting past runs)
2. **#2 Full brief generation** (6-8h, highest user value)
3. **#1 Channel-context filter** (4-6h, differentiator)
4. **#3 Weekly cron + email** (6-8h, recurring engagement moat)
5. **#5 Background task pattern** (4h, reliability before scaling traffic)

Everything else = v3 + polish.
