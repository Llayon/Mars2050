-- SQL to run in Supabase Dashboard → SQL Editor
-- Creates the pending_events table for timed game actions (attacks, building completion)

-- Pending events table (for timed game actions: attacks, building completion)
create table if not exists public.pending_events (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  type text not null check (type in ('building_complete', 'attack_arrive', 'attack_return', 'research_complete')),
  data jsonb not null default '{}'::jsonb,
  processed boolean default false not null,
  processed_at timestamp with time zone,
  completes_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Pending events policies
alter table public.pending_events enable row level security;

create policy "Users can view own pending events" on public.pending_events for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can manage own pending events" on public.pending_events for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create index if not exists pending_events_colony_id_idx on public.pending_events(colony_id);
create index if not exists pending_events_processed_idx on public.pending_events(processed) where processed = false;

-- Verify pending_events table exists
select 'pending_events table created' as status;
