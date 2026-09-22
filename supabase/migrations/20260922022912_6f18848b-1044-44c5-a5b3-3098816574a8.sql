WITH d AS (
  SELECT COALESCE(image_large, image_small) AS u,
         COUNT(DISTINCT COALESCE(base_card_id, id)) AS k,
         COUNT(DISTINCT name) AS distinct_names
  FROM public.tcg_cards
  WHERE COALESCE(image_large, image_small, '') <> ''
  GROUP BY 1
)
UPDATE public.tcg_cards c
SET image_small = NULL, image_large = NULL, updated_at = now()
FROM d
WHERE COALESCE(c.image_large, c.image_small) = d.u
  AND d.k > 1
  AND d.distinct_names > 1;