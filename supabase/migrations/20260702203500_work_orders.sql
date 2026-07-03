-- Work orders table (dotAGE-style timed colony operations)
CREATE TABLE IF NOT EXISTS public.work_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  colony_id UUID REFERENCES public.colonies(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('clear_rubble', 'repair_grid', 'survey_anomaly', 'trade_manifest')),
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed', 'claimed')),
  assigned_tier TEXT NOT NULL CHECK (assigned_tier IN ('worker', 'technician', 'scientist', 'director')),
  assigned_slots INTEGER NOT NULL CHECK (assigned_slots > 0),
  cost JSONB DEFAULT '{}'::JSONB NOT NULL,
  reward JSONB DEFAULT '{}'::JSONB NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL,
  completes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own colony work orders" ON public.work_orders;
CREATE POLICY "Users can view own colony work orders" ON public.work_orders FOR SELECT USING (
  colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can manage own colony work orders" ON public.work_orders;
CREATE POLICY "Users can manage own colony work orders" ON public.work_orders FOR ALL USING (
  colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS work_orders_colony_id_idx ON public.work_orders(colony_id);
CREATE INDEX IF NOT EXISTS work_orders_active_idx ON public.work_orders(colony_id, status, completes_at) WHERE status = 'active';

-- Atomic transaction for starting a timed work order.
CREATE OR REPLACE FUNCTION public.start_work_order_transaction(
  p_colony_id UUID,
  p_type TEXT,
  p_assigned_tier TEXT,
  p_assigned_slots INTEGER,
  p_duration_minutes INTEGER,
  p_cost JSONB,
  p_reward JSONB
) RETURNS JSONB AS $$
DECLARE
  v_pop public.population%ROWTYPE;
  v_available_population INTEGER;
  v_reserved_slots INTEGER;
  v_inserted_row public.work_orders%ROWTYPE;
  r_type TEXT;
  r_cost NUMERIC;
  v_available NUMERIC;
BEGIN
  IF p_assigned_slots IS NULL OR p_assigned_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order requires at least one assigned slot');
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work order duration must be positive');
  END IF;

  SELECT * INTO v_pop
  FROM public.population
  WHERE colony_id = p_colony_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Population not found');
  END IF;

  IF p_assigned_tier = 'worker' THEN
    v_available_population := v_pop.workers;
  ELSIF p_assigned_tier = 'technician' THEN
    v_available_population := v_pop.technicians;
  ELSIF p_assigned_tier = 'scientist' THEN
    v_available_population := v_pop.scientists;
  ELSIF p_assigned_tier = 'director' THEN
    v_available_population := v_pop.directors;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid assigned tier');
  END IF;

  PERFORM 1
  FROM public.work_orders
  WHERE colony_id = p_colony_id
    AND status = 'active'
    AND assigned_tier = p_assigned_tier
  FOR UPDATE;

  SELECT COALESCE(SUM(assigned_slots), 0)
  INTO v_reserved_slots
  FROM public.work_orders
  WHERE colony_id = p_colony_id
    AND status = 'active'
    AND assigned_tier = p_assigned_tier;

  IF v_available_population - v_reserved_slots < p_assigned_slots THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно свободных специалистов для задания');
  END IF;

  FOR r_type, r_cost IN
    SELECT key, value::NUMERIC FROM jsonb_each_text(COALESCE(p_cost, '{}'::JSONB))
  LOOP
    SELECT amount INTO v_available
    FROM public.resources
    WHERE colony_id = p_colony_id AND type = r_type
    FOR UPDATE;

    IF v_available IS NULL OR v_available < r_cost THEN
      RETURN jsonb_build_object('success', false, 'error', format('Недостаточно ресурсов. Требуется %s %s', r_cost, r_type));
    END IF;
  END LOOP;

  FOR r_type, r_cost IN
    SELECT key, value::NUMERIC FROM jsonb_each_text(COALESCE(p_cost, '{}'::JSONB))
  LOOP
    UPDATE public.resources
    SET amount = amount - r_cost,
        updated_at = NOW()
    WHERE colony_id = p_colony_id AND type = r_type;
  END LOOP;

  INSERT INTO public.work_orders (
    colony_id, type, status, assigned_tier, assigned_slots,
    cost, reward, completes_at
  )
  VALUES (
    p_colony_id, p_type, 'active', p_assigned_tier, p_assigned_slots,
    COALESCE(p_cost, '{}'::JSONB), COALESCE(p_reward, '{}'::JSONB),
    NOW() + make_interval(mins => p_duration_minutes)
  )
  RETURNING * INTO v_inserted_row;

  RETURN jsonb_build_object(
    'success', true,
    'work_order', row_to_json(v_inserted_row)::JSONB
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic transaction for claiming a completed work order reward.
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
    SET amount = amount + r_reward,
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
