-- PainScout — per-app Postgres schema. Runs on every deploy (idempotent).

CREATE TABLE IF NOT EXISTS analyses (
  id              UUID PRIMARY KEY,
  viewer_id       TEXT NOT NULL,
  niche           TEXT NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}',
  subs            JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'queued',
  error           TEXT,
  problems        JSONB NOT NULL DEFAULT '[]',
  raw_post_count  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convert legacy TEXT[] subs column to JSONB — gateway cannot serialize
-- JS arrays to Postgres array literals, only JSONB.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyses'
      AND column_name = 'subs'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE analyses ALTER COLUMN subs DROP DEFAULT;
    ALTER TABLE analyses ALTER COLUMN subs TYPE JSONB USING to_jsonb(subs);
    ALTER TABLE analyses ALTER COLUMN subs SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analyses_viewer ON analyses (viewer_id, created_at DESC);
