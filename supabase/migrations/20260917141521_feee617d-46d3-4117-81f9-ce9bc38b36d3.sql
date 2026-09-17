CREATE TABLE IF NOT EXISTS public.tcggo_probe_log (
  card_id text PRIMARY KEY,
  probed_at timestamptz NOT NULL DEFAULT now(),
  matched boolean NOT NULL DEFAULT false
);

GRANT ALL ON public.tcggo_probe_log TO service_role;

ALTER TABLE public.tcggo_probe_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tcggo_probe_log_service_role_all" ON public.tcggo_probe_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS tcggo_probe_log_probed_at_idx ON public.tcggo_probe_log (probed_at);

CREATE OR REPLACE FUNCTION public.tcggo_sync_candidates(_language text, _limit integer, _cooldown_days integer DEFAULT 14)
RETURNS TABLE(id text, name text, number text, set_code text, image_small text, market_price numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.number, c.set_code, c.image_small, c.market_price
  FROM public.tcg_cards c
  WHERE c.language = _language
    AND NOT EXISTS (
      SELECT 1 FROM public.tcggo_probe_log p
      WHERE p.card_id = c.id
        AND p.probed_at > now() - make_interval(days => greatest(_cooldown_days, 0))
    )
  ORDER BY (c.market_price IS NOT NULL), c.id
  LIMIT greatest(_limit, 1);
$function$;

REVOKE ALL ON FUNCTION public.tcggo_sync_candidates(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tcggo_sync_candidates(text, integer, integer) TO service_role;