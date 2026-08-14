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

  if _want < 0 then
    -- release unused reservations
    granted := greatest(_want, -used);
  else
    granted := greatest(least(_want, _cap - used), 0);
  end if;

  if granted <> 0 then
    update public.ebay_call_budget
      set calls = calls + granted, updated_at = now()
      where day = current_date;
  end if;
  return granted;
end;
$$;

revoke all on function public.ebay_reserve_calls(integer, integer) from public, anon, authenticated;
grant execute on function public.ebay_reserve_calls(integer, integer) to service_role;