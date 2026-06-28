-- Migration: Add terrain_grid and unlocked_radius to colonies table
-- This enables the new 40x40 terrain system with a restricted starting zone.

ALTER TABLE public.colonies
  ADD COLUMN terrain_grid JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN unlocked_radius INT DEFAULT 5;
