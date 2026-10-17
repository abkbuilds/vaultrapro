CREATE TABLE public.ai_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picked_on date NOT NULL DEFAULT current_date,
  kind text NOT NULL CHECK (kind IN ('card','sealed')),
  item_id text NOT NULL,
  name text NOT NULL,
  set_name text,
  image text,
  bucket text NOT NULL CHECK (bucket IN ('buy','sell','hold')),
  price_at_pick numeric NOT NULL,
  ai_score int NOT NULL,
  recommendation text NOT NULL,
  confidence int NOT NULL,
  risk_level text NOT NULL,
  expected_return_min numeric,
  expected_return_max numeric,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  thesis text,
  short_term_outlook text,
  long_term_outlook text,
  safety_explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (picked_on, kind, item_id)
);
CREATE INDEX ai_picks_day_idx ON public.ai_picks (picked_on DESC, kind, bucket);
GRANT SELECT ON public.ai_picks TO anon, authenticated;
GRANT ALL ON public.ai_picks TO service_role;
ALTER TABLE public.ai_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ai picks" ON public.ai_picks FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ai_pick_outcomes (
  pick_id uuid NOT NULL REFERENCES public.ai_picks(id) ON DELETE CASCADE,
  horizon_days int NOT NULL CHECK (horizon_days IN (30,60,90)),
  price_after numeric NOT NULL,
  return_pct numeric NOT NULL,
  win boolean NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pick_id, horizon_days)
);
GRANT SELECT ON public.ai_pick_outcomes TO anon, authenticated;
GRANT ALL ON public.ai_pick_outcomes TO service_role;
ALTER TABLE public.ai_pick_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pick outcomes" ON public.ai_pick_outcomes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.sealed_price_points (
  product_id text NOT NULL,
  captured_on date NOT NULL DEFAULT current_date,
  name text NOT NULL,
  episode text,
  image text,
  price_usd numeric NOT NULL,
  PRIMARY KEY (product_id, captured_on)
);
GRANT SELECT ON public.sealed_price_points TO anon, authenticated;
GRANT ALL ON public.sealed_price_points TO service_role;
ALTER TABLE public.sealed_price_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sealed points" ON public.sealed_price_points FOR SELECT TO anon, authenticated USING (true);