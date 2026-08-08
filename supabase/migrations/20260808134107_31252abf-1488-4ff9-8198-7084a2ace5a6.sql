REVOKE ALL ON public.catalog_sync_runs FROM anon, authenticated;
GRANT ALL ON public.catalog_sync_runs TO service_role;
ALTER TABLE public.catalog_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_sync_runs_service_role_all" ON public.catalog_sync_runs;
CREATE POLICY "catalog_sync_runs_service_role_all"
ON public.catalog_sync_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);