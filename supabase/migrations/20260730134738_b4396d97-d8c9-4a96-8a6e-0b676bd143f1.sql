CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- PROFILES -----------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CARD CATALOGUE ------------------------------------------------------------
CREATE TABLE public.tcg_sets (
  id text PRIMARY KEY,
  language text NOT NULL CHECK (language IN ('EN','JP')),
  game text NOT NULL DEFAULT 'pokemon',
  name text NOT NULL,
  code text,
  series text,
  printed_total integer,
  total integer,
  release_date date,
  logo_url text,
  symbol_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tcg_sets TO anon, authenticated;
GRANT ALL ON public.tcg_sets TO service_role;
ALTER TABLE public.tcg_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcg_sets_public_read" ON public.tcg_sets FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX tcg_sets_language_idx ON public.tcg_sets (language, release_date DESC);
CREATE INDEX tcg_sets_name_trgm_idx ON public.tcg_sets USING gin (name public.gin_trgm_ops);

CREATE TABLE public.tcg_cards (
  id text PRIMARY KEY,
  language text NOT NULL CHECK (language IN ('EN','JP')),
  game text NOT NULL DEFAULT 'pokemon',
  name text NOT NULL,
  native_name text,
  set_id text REFERENCES public.tcg_sets(id) ON DELETE CASCADE,
  set_name text NOT NULL,
  set_code text,
  number text NOT NULL,
  rarity text,
  supertype text,
  subtypes text[],
  types text[],
  hp integer,
  artist text,
  image_small text,
  image_large text,
  is_promo boolean NOT NULL DEFAULT false,
  release_date date,
  market_price numeric(12,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text text GENERATED ALWAYS AS (
    lower(coalesce(name,'') || ' ' || coalesce(native_name,'') || ' ' || coalesce(set_name,'') || ' ' || coalesce(set_code,'') || ' ' || coalesce(number,''))
  ) STORED
);
GRANT SELECT ON public.tcg_cards TO anon, authenticated;
GRANT ALL ON public.tcg_cards TO service_role;
ALTER TABLE public.tcg_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcg_cards_public_read" ON public.tcg_cards FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX tcg_cards_set_idx ON public.tcg_cards (set_id, number);
CREATE INDEX tcg_cards_language_idx ON public.tcg_cards (language);
CREATE INDEX tcg_cards_rarity_idx ON public.tcg_cards (rarity);
CREATE INDEX tcg_cards_search_trgm_idx ON public.tcg_cards USING gin (search_text public.gin_trgm_ops);

CREATE TABLE public.catalog_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL,
  sets_upserted integer NOT NULL DEFAULT 0,
  cards_upserted integer NOT NULL DEFAULT 0,
  detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.catalog_sync_runs TO anon, authenticated;
GRANT ALL ON public.catalog_sync_runs TO service_role;
ALTER TABLE public.catalog_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_runs_public_read" ON public.catalog_sync_runs FOR SELECT TO anon, authenticated USING (true);