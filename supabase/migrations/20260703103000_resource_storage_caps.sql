-- Add Anno-style resource storage caps.

CREATE OR REPLACE FUNCTION public.base_resource_capacity(p_type TEXT)
RETURNS NUMERIC AS $$
  SELECT CASE p_type
    WHEN 'oxygen' THEN 1000
    WHEN 'water' THEN 1000
    WHEN 'energy' THEN 1000
    WHEN 'minerals' THEN 1000
    WHEN 'food' THEN 1000
    WHEN 'research_points' THEN 500
    WHEN 'consumer_goods' THEN 300
    WHEN 'rare_metals' THEN 300
    WHEN 'databanks' THEN 300
    WHEN 'nanomaterials' THEN 150
    ELSE 0
  END;
$$ LANGUAGE SQL IMMUTABLE;

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS capacity NUMERIC DEFAULT 1000 NOT NULL;

UPDATE public.resources
SET capacity = GREATEST(amount, public.base_resource_capacity(type));

INSERT INTO public.building_types (type, name, base_cost, base_production, base_consumption, build_time, description)
VALUES (
  'storage_depot',
  'Складской узел',
  '{"minerals": 220, "energy": 60}'::JSONB,
  '{}'::JSONB,
  '{"energy": 2}'::JSONB,
  30,
  'Расширяет лимиты хранения ресурсов'
)
ON CONFLICT (type) DO UPDATE SET
  name = EXCLUDED.name,
  base_cost = EXCLUDED.base_cost,
  base_production = EXCLUDED.base_production,
  base_consumption = EXCLUDED.base_consumption,
  build_time = EXCLUDED.build_time,
  description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.increment_resource(
  p_colony_id UUID,
  p_type TEXT,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE public.resources
  SET amount = LEAST(GREATEST(capacity, amount), GREATEST(0, amount + p_amount))
  WHERE colony_id = p_colony_id AND type = p_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.initialize_colony(
  colony_name TEXT,
  location_id UUID
) RETURNS UUID AS $$
DECLARE
  new_colony_id UUID;
  resource_type TEXT;
  starting_amount NUMERIC;
BEGIN
  INSERT INTO public.colonies (user_id, name, location_id)
  VALUES (auth.uid(), colony_name, location_id)
  RETURNING id INTO new_colony_id;

  FOREACH resource_type IN ARRAY ARRAY['oxygen', 'water', 'energy', 'minerals', 'food']
  LOOP
    starting_amount := 500;
    INSERT INTO public.resources (colony_id, type, amount, capacity, production_rate, consumption_rate)
    VALUES (new_colony_id, resource_type, starting_amount, GREATEST(starting_amount, public.base_resource_capacity(resource_type)), 0, 0);
  END LOOP;

  INSERT INTO public.resources (colony_id, type, amount, capacity, production_rate, consumption_rate)
  VALUES (new_colony_id, 'research_points', 100, public.base_resource_capacity('research_points'), 0, 0);

  FOREACH resource_type IN ARRAY ARRAY['consumer_goods', 'rare_metals', 'databanks', 'nanomaterials']
  LOOP
    INSERT INTO public.resources (colony_id, type, amount, capacity, production_rate, consumption_rate)
    VALUES (new_colony_id, resource_type, 0, public.base_resource_capacity(resource_type), 0, 0);
  END LOOP;

  RETURN new_colony_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.recalculate_resources(
  p_colony_id UUID
) RETURNS SETOF public.resources AS $$
DECLARE
  v_elapsed_hours NUMERIC;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  SELECT EXTRACT(EPOCH FROM (v_now - last_calc_at)) / 3600.0
  INTO v_elapsed_hours
  FROM public.colonies
  WHERE id = p_colony_id;

  IF v_elapsed_hours IS NULL OR v_elapsed_hours < 1.0 / 3600.0 THEN
    RETURN QUERY SELECT * FROM public.resources WHERE colony_id = p_colony_id;
    RETURN;
  END IF;

  UPDATE public.resources
  SET amount = LEAST(GREATEST(capacity, amount), GREATEST(0, amount + (production_rate - consumption_rate) * v_elapsed_hours)),
      updated_at = v_now
  WHERE colony_id = p_colony_id;

  UPDATE public.colonies
  SET last_calc_at = v_now,
      updated_at = v_now
  WHERE id = p_colony_id;

  RETURN QUERY SELECT * FROM public.resources WHERE colony_id = p_colony_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.claim_work_order_transaction(
  p_colony_id UUID,
  p_work_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order public.work_orders%ROWTYPE;
  v_updated_row public.work_orders%ROWTYPE;
  r_type TEXT;
  r_reward NUMERIC;
BEGIN
  SELECT * INTO v_order
  FROM public.work_orders
  WHERE id = p_work_order_id AND colony_id = p_colony_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order not found');
  END IF;

  IF v_order.status = 'active' AND v_order.completes_at <= NOW() THEN
    UPDATE public.work_orders
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order is not ready to claim');
  END IF;

  FOR r_type, r_reward IN
    SELECT key, value::NUMERIC FROM jsonb_each_text(COALESCE(v_order.reward, '{}'::JSONB))
  LOOP
    UPDATE public.resources
    SET amount = LEAST(GREATEST(capacity, amount), amount + r_reward),
        updated_at = NOW()
    WHERE colony_id = p_colony_id AND type = r_type;
  END LOOP;

  UPDATE public.work_orders
  SET status = 'claimed',
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_updated_row;

  RETURN jsonb_build_object(
    'success', true,
    'work_order', row_to_json(v_updated_row)::JSONB
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
