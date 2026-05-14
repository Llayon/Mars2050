-- Optimized resource recalculation — single RPC call instead of 10+ roundtrips
-- Execute this in Supabase Dashboard → SQL Editor

create or replace function public.recalculate_resources(
  p_colony_id uuid
) returns setof public.resources as $$
declare
  v_elapsed_hours numeric;
  v_now timestamp with time zone := now();
  r record;
begin
  -- Get elapsed time since last calculation
  select extract(epoch from (v_now - last_calc_at)) / 3600.0
  into v_elapsed_hours
  from public.colonies
  where id = p_colony_id;

  -- Skip if less than 1 second
  if v_elapsed_hours is null or v_elapsed_hours < 1.0 / 3600.0 then
    return query select * from public.resources where colony_id = p_colony_id;
    return;
  end if;

  -- Update ALL resources in a single statement
  update public.resources
  set amount = greatest(0, amount + (
    case 
      when production_rate >= consumption_rate then (production_rate - consumption_rate) * v_elapsed_hours
      else (production_rate - consumption_rate) * v_elapsed_hours
    end
  )),
      updated_at = v_now
  where colony_id = p_colony_id;

  -- Update last_calc_at
  update public.colonies
  set last_calc_at = v_now,
      updated_at = v_now
  where id = p_colony_id;

  -- Return updated resources
  return query select * from public.resources where colony_id = p_colony_id;
end;
$$ language plpgsql security definer;
