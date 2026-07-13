-- Store combat QA metrics with replay snapshots so PvP replays can be
-- audited without re-simulating the battle.

-- Some remote preview branches can drift from the migration history and miss
-- the snapshot table created by 20260624000000_pvp_security_hardening.sql.
-- Keep this migration self-healing so the metrics column can be applied there.
create extension if not exists "uuid-ossp";

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'battle_snapshots'
      and policyname = 'Users can view snapshots of own battles'
  ) then
    create policy "Users can view snapshots of own battles" on public.battle_snapshots
      for select using (
        battle_id in (
          select id from public.battles
          where attacker_colony_id in (select id from public.colonies where user_id = auth.uid())
             or defender_colony_id in (select id from public.colonies where user_id = auth.uid())
        )
      );
  end if;
end $$;

alter table public.battle_snapshots
  add column if not exists metrics jsonb;
