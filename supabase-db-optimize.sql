-- DB Optimization Migration for Mars2050
-- 1. RLS optimization 2. Covering indexes 3. Fix missing columns

-- =====================================================================
-- 1. RLS optimization: security definer function instead of subquery
--    Eliminates the colony_id IN (SELECT ...) on EVERY query
-- =====================================================================
create or replace function public.auth_colony_ids()
returns setof uuid as $$
  select id from public.colonies where user_id = auth.uid()
$$ language sql stable security definer;

-- =====================================================================
-- 2. Updated RLS policies using the optimized function
-- =====================================================================
drop policy if exists "Users can view resources of own colonies" on public.resources;
create policy "Users can view resources of own colonies" on public.resources
  for select using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can update resources of own colonies" on public.resources;
create policy "Users can update resources of own colonies" on public.resources
  for update using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can view buildings of own colonies" on public.buildings;
create policy "Users can view buildings of own colonies" on public.buildings
  for select using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can manage buildings of own colonies" on public.buildings;
create policy "Users can manage buildings of own colonies" on public.buildings
  for all using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can view own colony events" on public.events;
create policy "Users can view own colony events" on public.events
  for select using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can manage own colony events" on public.events;
create policy "Users can manage own colony events" on public.events
  for all using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can view own pending events" on public.pending_events;
create policy "Users can view own pending events" on public.pending_events
  for select using (colony_id = any(select * from public.auth_colony_ids()));

drop policy if exists "Users can manage own pending events" on public.pending_events;
create policy "Users can manage own pending events" on public.pending_events
  for all using (colony_id = any(select * from public.auth_colony_ids()));

-- =====================================================================
-- 3. Covering indexes for hot queries
-- =====================================================================

-- resources: every query filters by (colony_id, type)
create index if not exists resources_colony_type_idx
  on public.resources(colony_id, type)
  include (amount, production_rate, consumption_rate);

-- events: getActiveEvents hot query
drop index if exists public.events_active_idx;
create index if not exists events_colony_active_ends_idx
  on public.events(colony_id, is_active, ends_at)
  where is_active = true;

-- pending_events: processCompletedEvents hot query  
drop index if exists public.pending_events_processed_idx;
create index if not exists pending_events_colony_complete_idx
  on public.pending_events(colony_id, processed, completes_at)
  where processed = false;

-- buildings: filter by colony_id + is_active
create index if not exists buildings_colony_active_idx
  on public.buildings(colony_id, is_active);

-- =====================================================================
-- 4. Fix missing last_calc_at column in colonies
-- =====================================================================
alter table public.colonies
  add column if not exists last_calc_at
  timestamp with time zone default timezone('utc'::text, now()) not null;

-- =====================================================================
-- 5. Auto-vacuum tuning for frequently-updated tables
-- =====================================================================
alter table public.resources set (autovacuum_vacuum_scale_factor = 0.01);
alter table public.events set (autovacuum_vacuum_scale_factor = 0.05);
alter table public.pending_events set (autovacuum_vacuum_scale_factor = 0.05);

-- =====================================================================
-- 6. Analyze to update query planner statistics
-- =====================================================================
analyze public.resources;
analyze public.events;
analyze public.buildings;
analyze public.pending_events;

select 'DB optimization complete' as status;
