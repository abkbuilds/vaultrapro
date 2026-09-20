ALTER TABLE public.tcg_cards ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'normal';
ALTER TABLE public.tcg_cards ADD COLUMN IF NOT EXISTS base_card_id text;

DROP INDEX IF EXISTS tcg_cards_search_text_trgm;
DROP INDEX IF EXISTS tcg_cards_search_trgm_idx;
ALTER TABLE public.tcg_cards DROP COLUMN IF EXISTS search_text;
ALTER TABLE public.tcg_cards ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    coalesce(name,'') || ' ' || coalesce(english_name,'') || ' ' || coalesce(native_name,'') || ' ' ||
    coalesce(set_name,'') || ' ' || coalesce(english_set_name,'') || ' ' ||
    coalesce(set_code,'') || ' ' || coalesce(number,'') || ' ' ||
    coalesce(set_code,'') || coalesce(number,'') || ' ' ||
    case when variant = 'reverse_holofoil' then 'reverse holofoil reverse holo' else 'normal' end
  )
) STORED;
CREATE INDEX IF NOT EXISTS tcg_cards_search_text_trgm ON public.tcg_cards USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tcg_cards_base_card_idx ON public.tcg_cards (base_card_id);
CREATE INDEX IF NOT EXISTS tcg_cards_variant_idx ON public.tcg_cards (variant);