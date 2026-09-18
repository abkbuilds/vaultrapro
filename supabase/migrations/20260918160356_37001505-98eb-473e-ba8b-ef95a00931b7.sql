ALTER TABLE public.tcg_cards ADD COLUMN IF NOT EXISTS price_change_7d numeric;

-- remove clearly mis-listed stored readings (20x away from that card+source median)
WITH agg AS (
  SELECT card_id, source, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS med, count(*) AS n
  FROM public.card_price_points GROUP BY card_id, source
)
DELETE FROM public.card_price_points p
USING agg a
WHERE p.card_id = a.card_id AND p.source = a.source
  AND a.n >= 3 AND a.med > 0
  AND (p.price > 20 * a.med OR p.price * 20 < a.med);

CREATE OR REPLACE FUNCTION public.refresh_market_prices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  WITH sale_avg AS (
    SELECT card_id, ROUND(AVG(price_usd), 2) AS price
    FROM (
      SELECT card_id, price_usd,
             row_number() OVER (PARTITION BY card_id ORDER BY sold_at DESC) AS rn
      FROM public.card_sales
      WHERE price_usd IS NOT NULL AND price_usd > 0
    ) s
    WHERE rn <= 5
    GROUP BY card_id
  ),
  sale_prev AS (
    SELECT card_id, ROUND(AVG(price_usd), 2) AS price
    FROM (
      SELECT card_id, price_usd,
             row_number() OVER (PARTITION BY card_id ORDER BY sold_at DESC) AS rn
      FROM public.card_sales
      WHERE price_usd IS NOT NULL AND price_usd > 0
        AND sold_at <= now() - interval '7 days'
    ) s
    WHERE rn <= 5
    GROUP BY card_id
  ),
  quoted AS (
    SELECT DISTINCT ON (card_id) card_id, ROUND(price, 2) AS price, change_7d
    FROM public.card_price_latest
    WHERE price > 0
    ORDER BY card_id,
      CASE source WHEN 'tcgplayer' THEN 1 WHEN 'cardmarket' THEN 2 WHEN 'ebay' THEN 3 ELSE 4 END,
      updated_at DESC
  ),
  best AS (
    SELECT COALESCE(s.card_id, q.card_id) AS card_id,
           COALESCE(s.price, q.price) AS price,
           CASE
             WHEN s.price IS NOT NULL AND pv.price > 0
               THEN ROUND(((s.price - pv.price) / pv.price) * 100, 2)
             WHEN s.price IS NULL THEN q.change_7d
           END AS change_7d
    FROM sale_avg s
    FULL OUTER JOIN quoted q ON q.card_id = s.card_id
    LEFT JOIN sale_prev pv ON pv.card_id = s.card_id
  ),
  clean AS (
    SELECT card_id, price,
           CASE WHEN change_7d IS NOT NULL AND abs(change_7d) <= 300 THEN change_7d END AS change_7d
    FROM best
  )
  UPDATE public.tcg_cards c
  SET market_price = b.price,
      price_change_7d = b.change_7d,
      updated_at = now()
  FROM clean b
  WHERE c.id = b.card_id
    AND (c.market_price IS DISTINCT FROM b.price OR c.price_change_7d IS DISTINCT FROM b.change_7d);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

SELECT public.refresh_price_changes();
SELECT public.refresh_market_prices();