-- Mars2050 Migration: Lazy resource calculation + pending events
-- Date: 2026-05-03

-- 1. Add last_calc_at to colonies for lazy resource calculation
ALTER TABLE public.colonies ADD COLUMN IF NOT EXISTS last_calc_at timestamptz DEFAULT now();

-- 2. Create pending_events table for timed game actions
CREATE TABLE public.pending_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  colony_id uuid REFERENCES public.colonies(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN (
    'building_complete',
    'attack_arrive',
    'attack_return',
    'research_complete'
  )),
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  completes_at timestamptz NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  processed_at timestamptz
);

-- 3. Index for fast lookup of unprocessed events
CREATE INDEX pending_events_colony_idx ON public.pending_events(colony_id);
CREATE INDEX pending_events_completes_idx ON public.pending_events(completes_at) WHERE processed = false;
CREATE INDEX pending_events_unprocessed_idx ON public.pending_events(processed, completes_at) WHERE processed = false;

-- 4. RLS for pending_events
ALTER TABLE public.pending_events ENABLE ROW LEVEL SECURITY;

-- Players can see their own pending events
CREATE POLICY "Users can view own events" ON public.pending_events
  FOR SELECT USING (
    colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
  );

-- 5. Set last_calc_at for existing colonies
UPDATE public.colonies SET last_calc_at = now() WHERE last_calc_at IS NULL;