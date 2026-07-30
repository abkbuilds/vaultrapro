ALTER TABLE public.tcg_sets
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;