WITH m AS (
  SELECT card_id, source, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS med
  FROM public.card_price_points
  GROUP BY 1,2
  HAVING count(*) >= 4
)
DELETE FROM public.card_price_points p
USING m
WHERE m.card_id = p.card_id
  AND m.source = p.source
  AND m.med > 0
  AND (p.price > m.med * 8 OR p.price * 8 < m.med);

SELECT public.refresh_price_changes();
SELECT public.refresh_market_prices();