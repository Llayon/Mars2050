-- Atomic transaction for building placement: resource check, deduction, and building creation.
CREATE OR REPLACE FUNCTION public.create_building_transaction(
  p_colony_id UUID,
  p_building_type TEXT,
  p_building_name TEXT,
  p_x INTEGER,
  p_y INTEGER,
  p_costs JSONB,
  p_group_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  r_type TEXT;
  r_cost NUMERIC;
  v_available NUMERIC;
  v_inserted_row public.buildings%ROWTYPE;
BEGIN
  -- 1. Lock resource rows and check if balance is sufficient
  FOR r_type, r_cost IN SELECT * FROM jsonb_each_text(p_costs) LOOP
    SELECT amount INTO v_available FROM public.resources 
      WHERE colony_id = p_colony_id AND type = r_type FOR UPDATE;
      
    IF v_available IS NULL OR v_available < r_cost::NUMERIC THEN
      RAISE EXCEPTION 'Недостаточно ресурса %: требуется %, доступно %', r_type, r_cost, COALESCE(v_available, 0);
    END IF;
  END LOOP;

  -- 2. Deduct resources atomically by subtraction
  FOR r_type, r_cost IN SELECT * FROM jsonb_each_text(p_costs) LOOP
    UPDATE public.resources 
      SET amount = amount - r_cost::NUMERIC
      WHERE colony_id = p_colony_id AND type = r_type;
  END LOOP;

  -- 3. Insert building
  INSERT INTO public.buildings (colony_id, type, name, level, is_active, x, y, group_id)
    VALUES (p_colony_id, p_building_type, p_building_name, 1, true, p_x, p_y, p_group_id)
    RETURNING * INTO v_inserted_row;

  RETURN jsonb_build_object(
    'success', true,
    'building', row_to_json(v_inserted_row)::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
