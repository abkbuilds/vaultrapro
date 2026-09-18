REVOKE ALL ON FUNCTION public.refresh_market_prices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_prices() TO service_role;