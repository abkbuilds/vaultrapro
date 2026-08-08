CREATE OR REPLACE FUNCTION public.refresh_price_changes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        ORDER BY p.captured_on DESC LIMIT 1) AS p30
    FROM latest l
  )
  INSERT INTO public.card_price_latest
    (card_id, source, price, currency, change_24h, change_7d, change_30d, updated_at)
  SELECT card_id, source, price, COALESCE(currency, 'USD'),
    CASE WHEN p1  > 0 THEN ROUND(((price - p1)  / p1)  * 100, 2) END,
    CASE WHEN p7  > 0 THEN ROUND(((price - p7)  / p7)  * 100, 2) END,
    CASE WHEN p30 > 0 THEN ROUND(((price - p30) / p30) * 100, 2) END,
    now()
  FROM base
  ON CONFLICT (card_id, source) DO UPDATE SET
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    change_24h = EXCLUDED.change_24h,
    change_7d = EXCLUDED.change_7d,
    change_30d = EXCLUDED.change_30d,
    updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_price_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_price_changes() TO service_role;

CREATE OR REPLACE FUNCTION public.card_trend(_card_id text)
RETURNS TABLE(window_days integer, pct numeric, from_price numeric, to_price numeric, from_date date)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH daily AS (
    SELECT captured_on, AVG(price) AS price
    FROM public.card_price_points
    WHERE card_id = _card_id AND currency = 'USD'
    GROUP BY captured_on
  ),
  cur AS (SELECT price FROM daily ORDER BY captured_on DESC LIMIT 1),
  w(days) AS (VALUES (7), (30), (90), (365), (1825))
  SELECT w.days,
    ROUND(((cur.price - b.price) / b.price) * 100, 2),
    ROUND(b.price, 2),
    ROUND(cur.price, 2),
    b.captured_on
  FROM w
  CROSS JOIN cur
  JOIN LATERAL (
    SELECT d.price, d.captured_on FROM daily d
    WHERE d.captured_on <= CURRENT_DATE - w.days
    ORDER BY d.captured_on DESC LIMIT 1
  ) b ON b.price > 0;
$$;

GRANT EXECUTE ON FUNCTION public.card_trend(text) TO anon, authenticated, service_role;