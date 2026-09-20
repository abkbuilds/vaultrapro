ALTER TABLE public.tcg_cards DROP COLUMN search_text;

ALTER TABLE public.tcg_cards ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    coalesce(name, '') || ' ' ||
    coalesce(english_name, '') || ' ' ||
    coalesce(native_name, '') || ' ' ||
    coalesce(set_name, '') || ' ' ||
    coalesce(english_set_name, '') || ' ' ||
    coalesce(set_code, '') || ' ' ||
    coalesce(number, '') || ' ' ||
    coalesce(set_code, '') || coalesce(number, '') || ' ' ||
    case variant
      when 'reverse_holofoil' then 'reverse holofoil reverse holo'
      when 'holofoil' then 'holofoil holo'
      else 'normal non-holo'
    end
  )
) STORED;

CREATE INDEX tcg_cards_search_text_trgm ON public.tcg_cards USING gin (search_text gin_trgm_ops);