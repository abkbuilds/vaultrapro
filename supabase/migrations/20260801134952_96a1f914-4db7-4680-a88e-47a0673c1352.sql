DROP POLICY IF EXISTS "sync_runs_public_read" ON public.catalog_sync_runs;
REVOKE ALL ON public.catalog_sync_runs FROM anon, authenticated;
GRANT ALL ON public.catalog_sync_runs TO service_role;