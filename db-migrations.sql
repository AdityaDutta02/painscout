-- PainScout — per-app Postgres schema. Runs once at deploy.

CREATE TABLE IF NOT EXISTS analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id       TEXT NOT NULL,
  niche           TEXT NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}',
  subs            TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'queued',
  error           TEXT,
  problems        JSONB NOT NULL DEFAULT '[]',
  raw_post_count  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_viewer ON analyses (viewer_id, created_at DESC);
