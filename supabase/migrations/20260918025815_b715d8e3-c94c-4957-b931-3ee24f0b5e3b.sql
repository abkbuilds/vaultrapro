ALTER TABLE public.tcggo_call_budget ADD COLUMN IF NOT EXISTS cards integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tcggo_reserve_cards(_want integer, _cap integer DEFAULT 14800)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  used integer;
  granted integer;
begin
  insert into public.tcggo_call_budget(day, calls) values (current_date, 0)
  on conflict (day) do nothing;

  select cards into used from public.tcggo_call_budget where day = current_date for update;

  if _want < 0 then
    granted := greatest(_want, -used);
  else
    granted := greatest(least(_want, _cap - used), 0);
  end if;

  if granted <> 0 then
    update public.tcggo_call_budget
      set cards = cards + granted, updated_at = now()
      where day = current_date;
  end if;
  return granted;
end;
$function$;