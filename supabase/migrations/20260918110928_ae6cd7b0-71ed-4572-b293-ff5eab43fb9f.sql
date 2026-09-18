-- 1. Purge outlier readings: a point more than 8x the card's median recorded
--    price (or less than an eighth of it), where we have at least 3 readings.
WITH med AS (
  SELECT card_id,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS m,
         count(*) AS n
  FROM public.card_price_points
  GROUP BY card_id
)
DELETE FROM public.card_price_points p
USING med
WHERE p.card_id = med.card_id
  AND med.n >= 3
  AND med.m > 0
  AND (p.price > med.m * 8 OR p.price * 8 < med.m);

-- Rebuild the latest table from the surviving points only.
DELETE FROM public.card_price_latest l
WHERE NOT EXISTS (
  SELECT 1 FROM public.card_price_points p
  WHERE p.card_id = l.card_id AND p.source = l.source
);

SELECT public.refresh_price_changes();

-- 2. Canonical headline price: average of the last 5 completed sales, else the
--    latest recorded marketplace reading (TCGplayer > Cardmarket > eBay).
CREATE OR REPLACE FUNCTION public.refresh_market_prices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  quoted AS (
    SELECT DISTINCT ON (card_id) card_id, ROUND(price, 2) AS price
    FROM public.card_price_latest
    WHERE price > 0
    ORDER BY card_id,
      CASE source WHEN 'tcgplayer' THEN 1 WHEN 'cardmarket' THEN 2 WHEN 'ebay' THEN 3 ELSE 4 END,
      updated_at DESC
  ),
  best AS (
    SELECT COALESCE(s.card_id, q.card_id) AS card_id,
           COALESCE(s.price, q.price) AS price
    FROM sale_avg s
    FULL OUTER JOIN quoted q ON q.card_id = s.card_id
  )
  UPDATE public.tcg_cards c
  SET market_price = b.price, updated_at = now()
  FROM best b
  WHERE c.id = b.card_id
    AND (c.market_price IS DISTINCT FROM b.price);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

SELECT public.refresh_market_prices();

-- 3. Daily distinct-card target for the price sync.
CREATE OR REPLACE FUNCTION public.tcggo_reserve_cards(_want integer, _cap integer DEFAULT 14500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  used integer;
  granted integer;
begin
  insert into public.tcggo_call_budget(day, calls) values (current_date, 0)
  on conflict (day) do nothing;

  select cards into used from public.tcggo_call_budget where day = current_date for update;

  if _want < 0 then
    granted := greatest(_want, -used);
  else
    granted := greatest(least(_want, _cap - used), 0);
  end if;

  if granted <> 0 then
    update public.tcggo_call_budget
      set cards = cards + granted, updated_at = now()
      where day = current_date;
  end if;
  return granted;
end;
$$;