CREATE OR REPLACE FUNCTION public.set_card_counts(lang text)
RETURNS TABLE (set_id text, n bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.set_id, count(*)::bigint
  FROM public.tcg_cards c
  WHERE c.language = lang AND c.set_id IS NOT NULL
  GROUP BY c.set_id;
$$;
REVOKE EXECUTE ON FUNCTION public.set_card_counts(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_card_counts(text) TO service_role;