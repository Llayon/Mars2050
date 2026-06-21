-- Таблица для юнитов (армии и гарнизона)
create table public.units (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  unit_type text not null check (unit_type in ('marine', 'exosuit', 'sniper', 'medic', 'rocketeer', 'engineer', 'wall', 'turret')),
  tier integer default 1 check (tier between 1 and 4),
  upgrade_path text[] default '{}',
  hp_current integer not null,
  grid_x integer,
  grid_y integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Таблица для истории боев и реплеев
create table public.battles (
  id uuid default uuid_generate_v4() primary key,
  attacker_colony_id uuid references public.colonies(id) not null,
  defender_colony_id uuid references public.colonies(id) not null,
  winner text check (winner in ('attacker', 'defender', 'draw')),
  attacker_units jsonb not null,
  defender_units jsonb not null,
  battle_log jsonb not null,
  rewards jsonb default '{}'::jsonb,
  trophies_change jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Настройки безопасности (RLS)
alter table public.units enable row level security;
alter table public.battles enable row level security;

create policy "Users can view own units" on public.units for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can insert own units" on public.units for insert with check (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can update own units" on public.units for update using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can delete own units" on public.units for delete using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can view battles they participated in" on public.battles for select using (
  attacker_colony_id in (select id from public.colonies where user_id = auth.uid()) or
  defender_colony_id in (select id from public.colonies where user_id = auth.uid())
);
