CREATE TABLE public.card_price_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL,
  source text NOT NULL,
  condition text NOT NULL DEFAULT 'Near Mint',
  price numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  captured_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX card_price_points_uniq
  ON public.card_price_points (card_id, source, condition, captured_on);
CREATE INDEX card_price_points_card_idx
  ON public.card_price_points (card_id, captured_on DESC);

GRANT SELECT ON public.card_price_points TO anon;
GRANT SELECT ON public.card_price_points TO authenticated;
GRANT ALL ON public.card_price_points TO service_role;

ALTER TABLE public.card_price_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price history is public"
  ON public.card_price_points FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE public.card_price_latest (
  card_id text NOT NULL,
  source text NOT NULL,
  price numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  change_24h numeric(8,2),
  change_7d numeric(8,2),
  change_30d numeric(8,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, source)
);

CREATE INDEX card_price_latest_change7d_idx ON public.card_price_latest (change_7d DESC);

GRANT SELECT ON public.card_price_latest TO anon;
GRANT SELECT ON public.card_price_latest TO authenticated;
GRANT ALL ON public.card_price_latest TO service_role;

ALTER TABLE public.card_price_latest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Latest prices are public"
  ON public.card_price_latest FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER card_price_latest_updated_at
  BEFORE UPDATE ON public.card_price_latest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();