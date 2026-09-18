REVOKE EXECUTE ON FUNCTION public.tcggo_reserve_cards(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tcggo_reserve_cards(integer, integer) TO service_role;