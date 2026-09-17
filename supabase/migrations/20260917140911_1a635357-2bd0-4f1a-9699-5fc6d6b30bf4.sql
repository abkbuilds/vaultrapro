select cron.schedule('tcggo-refresh-en', '13 */2 * * *', $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-tcggo',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"EN","limit":150,"onlyMissing":false}'::jsonb);
$j$);

select cron.schedule('tcggo-refresh-jp', '43 */2 * * *', $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-tcggo',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"JP","limit":150,"onlyMissing":false}'::jsonb);
$j$);