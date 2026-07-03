-- Atomic transaction for population upgrade: validates contract, deducts resources, and moves population.
CREATE OR REPLACE FUNCTION public.upgrade_population_transaction(
  p_colony_id UUID,
  p_from_tier TEXT,
  p_count INTEGER,
  p_costs JSONB,
  p_upgrade_building TEXT DEFAULT NULL,
  p_target_housing JSONB DEFAULT '{}'::JSONB,
  p_min_happiness INTEGER DEFAULT 80
) RETURNS JSONB AS $$
DECLARE
  v_pop public.population%ROWTYPE;
  v_updated_row public.population%ROWTYPE;
  v_from_count INTEGER;
  v_to_count INTEGER;
  v_happiness INTEGER;
  v_target_tier TEXT;
  v_required_building TEXT := NULLIF(p_upgrade_building, '');
  v_max_housing INTEGER := 0;
  v_building RECORD;
  v_capacity INTEGER;
  r_type TEXT;
  r_cost NUMERIC;
  v_total_cost NUMERIC;
  v_available NUMERIC;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Population upgrade count must be positive');
  END IF;

  SELECT * INTO v_pop
  FROM public.population
  WHERE colony_id = p_colony_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Population not found');
  END IF;

  IF p_from_tier = 'worker' THEN
    v_target_tier := 'technician';
    v_from_count := v_pop.workers;
    v_to_count := v_pop.technicians;
    v_happiness := v_pop.happiness_workers;
  ELSIF p_from_tier = 'technician' THEN
    v_target_tier := 'scientist';
    v_from_count := v_pop.technicians;
    v_to_count := v_pop.scientists;
    v_happiness := v_pop.happiness_technicians;
  ELSIF p_from_tier = 'scientist' THEN
    v_target_tier := 'director';
    v_from_count := v_pop.scientists;
    v_to_count := v_pop.directors;
    v_happiness := v_pop.happiness_scientists;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier for upgrade');
  END IF;

  IF v_from_count < p_count THEN
    RETURN jsonb_build_object('success', false, 'error', format('Not enough %ss to upgrade', p_from_tier));
  END IF;

  IF v_happiness < COALESCE(p_min_happiness, 80) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Уровень счастья должен быть не ниже 80% для модернизации');
  END IF;

  IF v_required_building IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.buildings
    WHERE colony_id = p_colony_id
      AND type = v_required_building
      AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Для улучшения требуется активное здание: %s', v_required_building));
  END IF;

  FOR v_building IN
    SELECT type, level
    FROM public.buildings
    WHERE colony_id = p_colony_id AND is_active = true
  LOOP
    v_capacity := COALESCE((p_target_housing ->> v_building.type)::INTEGER, 0);
    v_max_housing := v_max_housing + v_capacity * COALESCE(v_building.level, 1);
  END LOOP;

  IF v_to_count + p_count > v_max_housing THEN
    RETURN jsonb_build_object('success', false, 'error', format('Не хватает жилья для расселения %s (Максимум: %s)', v_target_tier, v_max_housing));
  END IF;

  FOR r_type, r_cost IN
    SELECT key, value::NUMERIC FROM jsonb_each_text(COALESCE(p_costs, '{}'::JSONB))
  LOOP
    v_total_cost := r_cost * p_count;
    SELECT amount INTO v_available
    FROM public.resources
    WHERE colony_id = p_colony_id AND type = r_type
    FOR UPDATE;

    IF v_available IS NULL OR v_available < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'error', format('Недостаточно ресурсов. Требуется %s %s', v_total_cost, r_type));
    END IF;
  END LOOP;

  FOR r_type, r_cost IN
    SELECT key, value::NUMERIC FROM jsonb_each_text(COALESCE(p_costs, '{}'::JSONB))
  LOOP
    UPDATE public.resources
    SET amount = amount - (r_cost * p_count),
        updated_at = NOW()
    WHERE colony_id = p_colony_id AND type = r_type;
  END LOOP;

  IF p_from_tier = 'worker' THEN
    UPDATE public.population
    SET workers = workers - p_count,
        technicians = technicians + p_count,
        updated_at = NOW()
    WHERE colony_id = p_colony_id
    RETURNING * INTO v_updated_row;
  ELSIF p_from_tier = 'technician' THEN
    UPDATE public.population
    SET technicians = technicians - p_count,
        scientists = scientists + p_count,
        updated_at = NOW()
    WHERE colony_id = p_colony_id
    RETURNING * INTO v_updated_row;
  ELSIF p_from_tier = 'scientist' THEN
    UPDATE public.population
    SET scientists = scientists - p_count,
        directors = directors + p_count,
        updated_at = NOW()
    WHERE colony_id = p_colony_id
    RETURNING * INTO v_updated_row;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'population', row_to_json(v_updated_row)::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
