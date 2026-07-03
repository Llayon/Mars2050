-- Add building staffing state expected by the economy allocation engine.
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS staffing_mode TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS assigned_workers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false;

UPDATE public.buildings
SET
  staffing_mode = COALESCE(staffing_mode, 'auto'),
  assigned_workers = COALESCE(assigned_workers, 0),
  work_priority = COALESCE(work_priority, 'normal'),
  paused = COALESCE(paused, false);

ALTER TABLE public.buildings
  ALTER COLUMN staffing_mode SET DEFAULT 'auto',
  ALTER COLUMN staffing_mode SET NOT NULL,
  ALTER COLUMN assigned_workers SET DEFAULT 0,
  ALTER COLUMN assigned_workers SET NOT NULL,
  ALTER COLUMN work_priority SET DEFAULT 'normal',
  ALTER COLUMN work_priority SET NOT NULL,
  ALTER COLUMN paused SET DEFAULT false,
  ALTER COLUMN paused SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_staffing_mode_check'
  ) THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT buildings_staffing_mode_check CHECK (staffing_mode IN ('auto', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_assigned_workers_check'
  ) THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT buildings_assigned_workers_check CHECK (assigned_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buildings_work_priority_check'
  ) THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT buildings_work_priority_check CHECK (work_priority IN ('low', 'normal', 'high'));
  END IF;
END $$;
