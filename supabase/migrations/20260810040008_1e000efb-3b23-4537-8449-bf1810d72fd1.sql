CREATE TABLE IF NOT EXISTS public.ebay_probe_log (
  card_id text PRIMARY KEY,
  probed_at timestamptz NOT NULL DEFAULT now(),
  matched boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.ebay_probe_log TO service_role;
ALTER TABLE public.ebay_probe_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ebay_probe_log_service_role_all ON public.ebay_probe_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.ebay_sync_candidates(_language text, _strategy text, _limit int)
RETURNS TABLE(id text, name text, english_name text, number text, set_name text, set_code text, language text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.english_name, c.number, c.set_name, c.set_code, c.language
  FROM public.tcg_cards c
  WHERE c.language = _language
    AND NOT EXISTS (
      SELECT 1 FROM public.ebay_probe_log p
      WHERE p.card_id = c.id AND p.probed_at > now() - interval '14 days'
    )
    AND (
      (_strategy = 'unpriced'
        AND NOT EXISTS (SELECT 1 FROM public.card_price_latest l WHERE l.card_id = c.id))
      OR
      (_strategy = 'missing-ebay'
        AND NOT EXISTS (SELECT 1 FROM public.card_price_latest l WHERE l.card_id = c.id AND l.source = 'ebay'))
      OR
      (_strategy = 'refresh'
        AND EXISTS (SELECT 1 FROM public.card_price_latest l WHERE l.card_id = c.id AND l.source = 'ebay'))
    )
  ORDER BY
    CASE WHEN _strategy = 'refresh'
      THEN (SELECT l.updated_at FROM public.card_price_latest l WHERE l.card_id = c.id AND l.source = 'ebay')
    END ASC NULLS LAST,
    COALESCE(
      (SELECT max(l.price) FROM public.card_price_latest l WHERE l.card_id = c.id),
      c.market_price,
      0
    ) DESC,
    c.id ASC
  LIMIT greatest(_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.ebay_sync_candidates(text, text, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ebay_sync_candidates(text, text, int) TO service_role;