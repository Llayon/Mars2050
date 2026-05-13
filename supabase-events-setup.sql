-- SQL to run in Supabase Dashboard → SQL Editor
-- This creates the events table and related functions for Mars2050

-- Events table (Surviving Mars inspired)
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  type text not null check (type in ('dust_storm', 'meteor_shower', 'anomaly_discovered', 'resource_vein', 'cold_wave', 'solar_flare')),
  name text not null,
  description text not null,
  effect jsonb not null default '{}'::jsonb,
  duration_minutes integer,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ends_at timestamp with time zone
);

-- Events policies
alter table public.events enable row level security;

create policy "Users can view own colony events" on public.events for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can manage own colony events" on public.events for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create index if not exists events_colony_id_idx on public.events(colony_id);
create index if not exists events_active_idx on public.events(is_active) where is_active = true;

-- Function to increment resource (for event rewards)
create or replace function public.increment_resource(
  p_colony_id uuid,
  p_type text,
  p_amount numeric
) returns void as $$
begin
  update public.resources
  set amount = amount + p_amount
  where colony_id = p_colony_id and type = p_type;
end;
$$ language plpgsql security definer;

-- Verify events table exists
select 'events table created' as status;
