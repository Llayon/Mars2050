-- Migration: Add spatial coordinates and grouping to buildings
-- Phase 0 of Isometric UI Implementation
-- Triggering native integration test

ALTER TABLE public.buildings 
ADD COLUMN x integer,
ADD COLUMN y integer,
ADD COLUMN group_id text;

-- Set default coordinates for existing buildings (center of the map)
UPDATE public.buildings 
SET x = 10, y = 10 
WHERE x IS NULL OR y IS NULL;

-- Make coordinates mandatory for future buildings
ALTER TABLE public.buildings 
ALTER COLUMN x SET NOT NULL,
ALTER COLUMN y SET NOT NULL;

-- Add index for spatial queries
CREATE INDEX buildings_coords_idx ON public.buildings(x, y);
CREATE INDEX buildings_group_idx ON public.buildings(group_id);

COMMENT ON COLUMN public.buildings.x IS 'Grid X coordinate for isometric map';
COMMENT ON COLUMN public.buildings.y IS 'Grid Y coordinate for isometric map';
COMMENT ON COLUMN public.buildings.group_id IS 'Logical grouping of buildings (e.g., energy_sector)';
