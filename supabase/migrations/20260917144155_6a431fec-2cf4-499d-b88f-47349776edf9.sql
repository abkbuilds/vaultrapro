DROP POLICY IF EXISTS "Sale history readable by signed-in users" ON public.card_sales;
REVOKE SELECT ON public.card_sales FROM authenticated, anon;
GRANT ALL ON public.card_sales TO service_role;

REVOKE ALL ON public.ebay_call_budget FROM authenticated, anon;
GRANT ALL ON public.ebay_call_budget TO service_role;
ALTER TABLE public.ebay_call_budget ENABLE ROW LEVEL SECURITY;