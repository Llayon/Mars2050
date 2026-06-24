-- Battle replay snapshots: heavy replay payload separated from battles summary.
-- The battles table holds only the summary (participants, winner, status, created_at).
-- battle_snapshots holds seed, initial_state, and tick log for replay/audit.

create table if not exists public.battle_snapshots (
  id uuid default uuid_generate_v4() primary key,
  battle_id uuid references public.battles(id) on delete cascade not null unique,
  seed integer not null,
  initial_state jsonb not null,
  log jsonb not null,
  version integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists battle_snapshots_battle_id_idx
  on public.battle_snapshots(battle_id);

alter table public.battle_snapshots enable row level security;

-- Defense-in-depth: service_role bypasses RLS, but anon/auth reads must be scoped
-- to battles the user participated in.
create policy "Users can view snapshots of own battles" on public.battle_snapshots
  for select using (
    battle_id in (
      select id from public.battles
      where attacker_colony_id in (select id from public.colonies where user_id = auth.uid())
         or defender_colony_id in (select id from public.colonies where user_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated role.
-- Mutations are server-side only via service_role (the API layer enforces ownership).
-- This keeps the snapshot immutable from clients.

-- Tighten existing battles table: the original migration only had a SELECT policy.
-- Add explicit no-write policies so service_role is the only writer.
create policy "No client insert on battles" on public.battles
  for insert with check (false);

create policy "No client update on battles" on public.battles
  for update using (false);

create policy "No client delete on battles" on public.battles
  for delete using (false);
