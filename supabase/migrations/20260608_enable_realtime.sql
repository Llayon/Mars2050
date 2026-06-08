-- Mars2050 Migration: Enable Supabase Realtime for game tables
-- Date: 2026-06-08
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/gkvsnzwvgonfpuespafm/sql/new

-- 1. Enable Realtime publication for game tables
-- Each table needs to be added to the supabase_realtime publication
-- so that Postgres changes are broadcast to connected clients.

ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buildings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_locations;

-- 2. Verify publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
