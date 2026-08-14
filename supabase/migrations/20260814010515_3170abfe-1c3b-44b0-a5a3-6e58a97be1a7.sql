create table if not exists public.ebay_call_budget (
  day date primary key,
  calls integer not null default 0,
  updated_at timestamptz not null default now()
);

grant all on public.ebay_call_budget to service_role;
alter table public.ebay_call_budget enable row level security;
drop policy if exists "service role manages ebay budget" on public.ebay_call_budget;
create policy "service role manages ebay budget" on public.ebay_call_budget
  for all to service_role using (true) with check (true);

create or replace function public.ebay_reserve_calls(_want integer, _cap integer default 4800)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  granted integer;
begin
  insert into public.ebay_call_budget(day, calls) values (current_date, 0)
  on conflict (day) do nothing;

  select calls into used from public.ebay_call_budget where day = current_date for update;

  granted := greatest(least(_want, _cap - used), 0);
  if granted > 0 then
    update public.ebay_call_budget
      set calls = calls + granted, updated_at = now()
      where day = current_date;
  end if;
  return granted;
end;
$$;

revoke all on function public.ebay_reserve_calls(integer, integer) from public, anon, authenticated;
grant execute on function public.ebay_reserve_calls(integer, integer) to service_role;

select cron.alter_job(6, schedule := '7 * * * *', command := $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-ebay',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"EN","limit":100,"strategy":"missing-ebay"}'::jsonb);
$j$);

select cron.alter_job(7, schedule := '22 * * * *', command := $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-ebay',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"JP","limit":80,"strategy":"missing-ebay"}'::jsonb);
$j$);

select cron.alter_job(8, schedule := '42 */4 * * *', command := $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-ebay',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"JP","limit":60,"strategy":"unpriced"}'::jsonb);
$j$);

select cron.schedule('ebay-prices-refresh', '52 */4 * * *', $j$
  SELECT net.http_post(
    url:='https://project--2e68f372-b76b-4004-bfa4-a81e76faf004.lovable.app/api/public/sync-ebay',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"language":"EN","limit":60,"strategy":"refresh"}'::jsonb);
$j$);