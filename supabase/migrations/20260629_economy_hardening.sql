-- Migrations for economy hardening and lazy calc stabilization
-- 20260629_economy_hardening.sql

-- 1. Ensure colonies table has last_calc_at column
ALTER TABLE public.colonies ADD COLUMN IF NOT EXISTS last_calc_at timestamp with time zone DEFAULT now() NOT NULL;

-- 2. Ensure buildings table has placement and grouping columns
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS x integer;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS y integer;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS group_id text;

-- 3. Backfill buildings.x/y for old buildings
UPDATE public.buildings SET x = 10, y = 10 WHERE x IS NULL OR y IS NULL;
ALTER TABLE public.buildings ALTER COLUMN x SET NOT NULL;
ALTER TABLE public.buildings ALTER COLUMN y SET NOT NULL;

-- 4. Backfill missing resources for old colonies
INSERT INTO public.resources (colony_id, type, amount, production_rate, consumption_rate)
SELECT c.id, t.type, 0, 0, 0
FROM public.colonies c
CROSS JOIN (
  VALUES 
    ('consumer_goods'), 
    ('rare_metals'), 
    ('databanks'), 
    ('nanomaterials')
) as t(type)
ON CONFLICT (colony_id, type) DO NOTHING;

-- 5. Backfill missing population for old colonies
INSERT INTO public.population (colony_id, workers, technicians, scientists, directors)
SELECT c.id, 10, 0, 0, 0
FROM public.colonies c
LEFT JOIN public.population p ON p.colony_id = c.id
WHERE p.id IS NULL
ON CONFLICT (colony_id) DO NOTHING;

-- 6. Recalculation RPC definition
CREATE OR REPLACE FUNCTION public.recalculate_resources(
  p_colony_id uuid
) RETURNS SETOF public.resources AS $$
DECLARE
  v_elapsed_hours numeric;
  v_now timestamp with time zone := now();
BEGIN
  -- Get elapsed time since last calculation
  SELECT extract(epoch from (v_now - last_calc_at)) / 3600.0
  INTO v_elapsed_hours
  FROM public.colonies
  WHERE id = p_colony_id;

  -- Skip if less than 1 second
  IF v_elapsed_hours IS NULL OR v_elapsed_hours < 1.0 / 3600.0 THEN
    RETURN QUERY SELECT * FROM public.resources WHERE colony_id = p_colony_id;
    RETURN;
  END IF;

  -- Update ALL resources in a single statement
  UPDATE public.resources
  SET amount = greatest(0, amount + (production_rate - consumption_rate) * v_elapsed_hours),
      updated_at = v_now
  WHERE colony_id = p_colony_id;

  -- Update last_calc_at
  UPDATE public.colonies
  SET last_calc_at = v_now,
      updated_at = v_now
  WHERE id = p_colony_id;

  -- Return updated resources
  RETURN QUERY SELECT * FROM public.resources WHERE colony_id = p_colony_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
