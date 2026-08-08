ALTER TABLE public.card_price_latest
  ADD CONSTRAINT card_price_latest_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES public.tcg_cards(id) ON DELETE CASCADE;