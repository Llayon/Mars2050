-- 20260628_03_population.sql
CREATE TABLE public.population (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null unique,
  workers integer not null default 10,
  technicians integer not null default 0,
  scientists integer not null default 0,
  directors integer not null default 0,
  happiness_workers integer not null default 50,
  happiness_technicians integer not null default 50,
  happiness_scientists integer not null default 50,
  happiness_directors integer not null default 50,
  growth_progress numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies
ALTER TABLE public.population ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own colony population" ON public.population FOR SELECT USING (
  colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage own colony population" ON public.population FOR ALL USING (
  colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
);

-- Function to auto-create population
CREATE OR REPLACE FUNCTION public.create_population_for_colony()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.population (colony_id, workers)
  VALUES (NEW.id, 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_colony_population
  AFTER INSERT ON public.colonies
  FOR EACH ROW EXECUTE FUNCTION public.create_population_for_colony();
