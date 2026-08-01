ALTER TABLE public.tcg_cards ADD COLUMN IF NOT EXISTS english_name text;
ALTER TABLE public.tcg_cards ADD COLUMN IF NOT EXISTS english_set_name text;
ALTER TABLE public.tcg_sets ADD COLUMN IF NOT EXISTS english_name text;

DROP INDEX IF EXISTS tcg_cards_search_text_trgm;
ALTER TABLE public.tcg_cards DROP COLUMN IF EXISTS search_text;
ALTER TABLE public.tcg_cards ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    coalesce(name,'') || ' ' || coalesce(english_name,'') || ' ' || coalesce(native_name,'') || ' ' ||
    coalesce(set_name,'') || ' ' || coalesce(english_set_name,'') || ' ' ||
    coalesce(set_code,'') || ' ' || coalesce(number,'') || ' ' ||
    coalesce(set_code,'') || coalesce(number,'')
  )
) STORED;
CREATE INDEX IF NOT EXISTS tcg_cards_search_text_trgm ON public.tcg_cards USING gin (search_text gin_trgm_ops);