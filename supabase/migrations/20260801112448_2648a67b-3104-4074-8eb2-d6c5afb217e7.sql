CREATE TABLE public.card_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id TEXT NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_usd NUMERIC(12,2),
  condition TEXT,
  title TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT card_sales_source_external_unique UNIQUE (source, external_id)
);

CREATE INDEX card_sales_card_sold_idx ON public.card_sales (card_id, sold_at DESC);

GRANT SELECT ON public.card_sales TO anon;
GRANT SELECT ON public.card_sales TO authenticated;
GRANT ALL ON public.card_sales TO service_role;

ALTER TABLE public.card_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sale history is publicly readable"
ON public.card_sales FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_card_sales_updated_at
BEFORE UPDATE ON public.card_sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();