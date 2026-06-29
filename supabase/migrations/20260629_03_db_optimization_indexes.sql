-- Migration: Add missing database indexes for performance optimization
-- 20260629_03_db_optimization_indexes.sql

-- Index for units (critically speeds up army upkeep calculations and RLS checks)
CREATE INDEX IF NOT EXISTS units_colony_id_idx ON public.units(colony_id);

-- Indexes for battles (speeds up battle history queries)
CREATE INDEX IF NOT EXISTS battles_attacker_colony_id_idx ON public.battles(attacker_colony_id);
CREATE INDEX IF NOT EXISTS battles_defender_colony_id_idx ON public.battles(defender_colony_id);
