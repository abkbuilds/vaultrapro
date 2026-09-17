create table if not exists public.tcggo_call_budget (
  day date primary key,
  calls integer not null default 0,
  updated_at timestamptz not null default now()
);

grant all on public.tcggo_call_budget to service_role;
alter table public.tcggo_call_budget enable row level security;
drop policy if exists "service role manages tcggo budget" on public.tcggo_call_budget;
create policy "service role manages tcggo budget" on public.tcggo_call_budget
  for all to service_role using (true) with check (true);

create or replace function public.tcggo_reserve_calls(_want integer, _cap integer default 14400)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  granted integer;
begin
  insert into public.tcggo_call_budget(day, calls) values (current_date, 0)
  on conflict (day) do nothing;

  select calls into used from public.tcggo_call_budget where day = current_date for update;

  if _want < 0 then
    granted := greatest(_want, -used);
  else
    granted := greatest(least(_want, _cap - used), 0);
  end if;

  if granted <> 0 then
    update public.tcggo_call_budget
      set calls = calls + granted, updated_at = now()
      where day = current_date;
  end if;
  return granted;
end;
$$;

revoke all on function public.tcggo_reserve_calls(integer, integer) from public, anon, authenticated;
grant execute on function public.tcggo_reserve_calls(integer, integer) to service_role;