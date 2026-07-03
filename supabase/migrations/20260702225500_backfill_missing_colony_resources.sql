-- Ensure every existing colony has the full resource row set.
-- Existing balances are preserved by the unique (colony_id, type) conflict guard.
INSERT INTO public.resources (colony_id, type, amount, production_rate, consumption_rate)
SELECT c.id, r.type, r.amount, 0, 0
FROM public.colonies c
CROSS JOIN (
  VALUES
    ('oxygen', 500::NUMERIC),
    ('water', 500::NUMERIC),
    ('energy', 500::NUMERIC),
    ('minerals', 500::NUMERIC),
    ('food', 500::NUMERIC),
    ('research_points', 100::NUMERIC),
    ('consumer_goods', 0::NUMERIC),
    ('rare_metals', 0::NUMERIC),
    ('databanks', 0::NUMERIC),
    ('nanomaterials', 0::NUMERIC)
) AS r(type, amount)
ON CONFLICT (colony_id, type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.initialize_colony(
  colony_name TEXT,
  location_id UUID
) RETURNS UUID AS $$
DECLARE
  new_colony_id UUID;
  resource_type TEXT;
BEGIN
  INSERT INTO public.colonies (user_id, name, location_id)
  VALUES (auth.uid(), colony_name, location_id)
  RETURNING id INTO new_colony_id;

  FOREACH resource_type IN ARRAY ARRAY['oxygen', 'water', 'energy', 'minerals', 'food']
  LOOP
    INSERT INTO public.resources (colony_id, type, amount, production_rate, consumption_rate)
    VALUES (new_colony_id, resource_type, 500, 0, 0);
  END LOOP;

  INSERT INTO public.resources (colony_id, type, amount, production_rate, consumption_rate)
  VALUES (new_colony_id, 'research_points', 100, 0, 0);

  FOREACH resource_type IN ARRAY ARRAY['consumer_goods', 'rare_metals', 'databanks', 'nanomaterials']
  LOOP
    INSERT INTO public.resources (colony_id, type, amount, production_rate, consumption_rate)
    VALUES (new_colony_id, resource_type, 0, 0, 0);
  END LOOP;

  RETURN new_colony_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
