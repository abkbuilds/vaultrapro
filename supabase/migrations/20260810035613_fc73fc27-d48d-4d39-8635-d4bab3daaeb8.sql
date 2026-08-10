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