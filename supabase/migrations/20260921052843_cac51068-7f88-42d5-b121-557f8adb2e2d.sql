ALTER TABLE public.card_price_latest ADD COLUMN IF NOT EXISTS change_1y numeric;

CREATE OR REPLACE FUNCTION public.refresh_price_changes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (card_id, source) card_id, source, price, currency, captured_on
    FROM public.card_price_points
    ORDER BY card_id, source, captured_on DESC
  ),
  base AS (
    SELECT l.*,
      (SELECT p.price FROM public.card_price_points p
        WHERE p.card_id = l.card_id AND p.source = l.source
          AND p.captured_on <= CURRENT_DATE - 1
        ORDER BY p.captured_on DESC LIMIT 1) AS p1,
      (SELECT p.price FROM public.card_price_points p
        WHERE p.card_id = l.card_id AND p.source = l.source
          AND p.captured_on <= CURRENT_DATE - 7
        ORDER BY p.captured_on DESC LIMIT 1) AS p7,
      (SELECT p.price FROM public.card_price_points p
        WHERE p.card_id = l.card_id AND p.source = l.source
          AND p.captured_on <= CURRENT_DATE - 30
        ORDER BY p.captured_on DESC LIMIT 1) AS p30,
      (SELECT p.price FROM public.card_price_points p
        WHERE p.card_id = l.card_id AND p.source = l.source
          AND p.captured_on <= CURRENT_DATE - 365
        ORDER BY p.captured_on DESC LIMIT 1) AS p365
    FROM latest l
  )
  INSERT INTO public.card_price_latest
    (card_id, source, price, currency, change_24h, change_7d, change_30d, change_1y, updated_at)
  SELECT card_id, source, price, COALESCE(currency, 'USD'),
    CASE WHEN p1   > 0 THEN ROUND(((price - p1)   / p1)   * 100, 2) END,
    CASE WHEN p7   > 0 THEN ROUND(((price - p7)   / p7)   * 100, 2) END,
    CASE WHEN p30  > 0 THEN ROUND(((price - p30)  / p30)  * 100, 2) END,
    CASE WHEN p365 > 0 THEN ROUND(((price - p365) / p365) * 100, 2) END,
    now()
  FROM base
  ON CONFLICT (card_id, source) DO UPDATE SET
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    change_24h = EXCLUDED.change_24h,
    change_7d = EXCLUDED.change_7d,
    change_30d = EXCLUDED.change_30d,
    change_1y = EXCLUDED.change_1y,
    updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;