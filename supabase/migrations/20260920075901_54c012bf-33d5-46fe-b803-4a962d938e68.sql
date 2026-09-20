DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'jp-image-coverage' LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
END $$;

SELECT cron.schedule('jp-image-coverage', '17 4 * * 1', $job$
  SELECT net.http_post(
    url := 'https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-jp-images',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-refresh-token', coalesce(
        (SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name = 'PRICE_REFRESH_TOKEN' LIMIT 1),
        ''
      )
    ),
    body := '{"limit":30,"offset":0}'::jsonb
  );
$job$);