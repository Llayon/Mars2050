-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  avatar_url text,
  telegram_id bigint unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Colonies table
create table public.colonies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  location_id uuid,
  level integer default 1,
  experience bigint default 0,
  terrain_grid jsonb default '[]'::jsonb,
  unlocked_radius integer default 5,
  last_calc_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Resources table
create table public.resources (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  type text not null check (type in ('oxygen', 'water', 'energy', 'minerals', 'food', 'research_points', 'consumer_goods', 'rare_metals', 'databanks', 'nanomaterials')),
  amount numeric default 0 not null,
  production_rate numeric default 0 not null,
  consumption_rate numeric default 0 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(colony_id, type)
);

-- Buildings table
create table public.buildings (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  type text not null,
  name text not null,
  level integer default 1 not null,
  is_active boolean default true,
  x integer not null,
  y integer not null,
  group_id text,
  staffing_mode text default 'auto' not null check (staffing_mode in ('auto', 'manual')),
  assigned_workers integer default 0 not null,
  work_priority text default 'normal' not null check (work_priority in ('low', 'normal', 'high')),
  paused boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Map locations table
create table public.map_locations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text check (type in ('plains', 'mountains', 'canyon', 'crater', 'ice_cap')) not null,
  x integer not null,
  y integer not null,
  difficulty integer check (difficulty between 1 and 5) not null,
  resources jsonb default '{}'::jsonb,
  is_discovered boolean default false,
  discovered_by uuid references public.colonies(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Population table
create table public.population (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null unique,
  workers integer not null default 10,
  technicians integer not null default 0,
  scientists integer not null default 0,
  directors integer not null default 0,
  happiness_workers integer not null default 50,
  happiness_technicians integer not null default 50,
  happiness_scientists integer not null default 50,
  happiness_directors integer not null default 50,
  growth_progress numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Auto-create population trigger
create or replace function public.create_population_for_colony()
returns trigger as $$
begin
  insert into public.population (colony_id, workers)
  values (new.id, 10);
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_colony_population
  after insert on public.colonies
  for each row execute function public.create_population_for_colony();

-- Building types catalog
create table public.building_types (
  type text primary key,
  name text not null,
  base_cost jsonb not null,
  base_production jsonb default '{}'::jsonb,
  base_consumption jsonb default '{}'::jsonb,
  build_time integer not null,
  description text
);

-- Insert default building types
insert into public.building_types (type, name, base_cost, base_production, base_consumption, build_time, description) values
('oxygen_generator', 'Кислородный генератор', '{"minerals": 100, "energy": 50}'::jsonb, '{"oxygen": 10}'::jsonb, '{"energy": 5}'::jsonb, 30, 'Производит кислород для колонии'),
('water_extractor', 'Водяной насос', '{"minerals": 120, "energy": 60}'::jsonb, '{"water": 8}'::jsonb, '{"energy": 8}'::jsonb, 35, 'Добывает воду из марсианских льдов'),
('solar_panels', 'Солнечные панели', '{"minerals": 80, "energy": 20}'::jsonb, '{"energy": 15}'::jsonb, '{}'::jsonb, 20, 'Генерирует энергию из солнечного света'),
('mine', 'Шахта', '{"minerals": 150, "energy": 40}'::jsonb, '{"minerals": 12}'::jsonb, '{"energy": 10}'::jsonb, 40, 'Добывает полезные ископаемые'),
('greenhouse', 'Теплица', '{"minerals": 100, "water": 30}'::jsonb, '{"food": 6}'::jsonb, '{"water": 4, "energy": 3}'::jsonb, 35, 'Выращивает еду для колонистов'),
('research_lab', 'Исследовательская лаборатория', '{"minerals": 200, "energy": 80}'::jsonb, '{"research_points": 5}'::jsonb, '{"energy": 15, "water": 2}'::jsonb, 50, 'Проводит научные исследования');

-- RLS (Row Level Security) policies
alter table public.profiles enable row level security;
alter table public.colonies enable row level security;
alter table public.resources enable row level security;
alter table public.buildings enable row level security;
alter table public.map_locations enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Colonies policies
create policy "Users can view own colonies" on public.colonies for select using (auth.uid() = user_id);
create policy "Users can insert own colonies" on public.colonies for insert with check (auth.uid() = user_id);
create policy "Users can update own colonies" on public.colonies for update using (auth.uid() = user_id);

-- Population policies
alter table public.population enable row level security;
create policy "Users can view own colony population" on public.population for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);
create policy "Users can manage own colony population" on public.population for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

-- Resources policies
create policy "Users can view resources of own colonies" on public.resources for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);
create policy "Users can update resources of own colonies" on public.resources for update using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

-- Buildings policies
create policy "Users can view buildings of own colonies" on public.buildings for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);
create policy "Users can manage buildings of own colonies" on public.buildings for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

-- Map locations policies (visible to all authenticated users)
create policy "Authenticated users can view map locations" on public.map_locations for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update discovered locations" on public.map_locations for update using (auth.role() = 'authenticated');

-- Indexes
create index colonies_user_id_idx on public.colonies(user_id);
create index resources_colony_id_idx on public.resources(colony_id);
create index buildings_colony_id_idx on public.buildings(colony_id);
create index map_locations_coords_idx on public.map_locations(x, y);
create index profiles_telegram_id_idx on public.profiles(telegram_id) where telegram_id is not null;

-- Events table (Surviving Mars inspired)
create table public.events (
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

-- Pending events table (for timed game actions: attacks, building completion)
create table public.pending_events (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  type text not null check (type in ('building_complete', 'attack_arrive', 'attack_return', 'research_complete')),
  data jsonb not null default '{}'::jsonb,
  processed boolean default false not null,
  processed_at timestamp with time zone,
  completes_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Events policies
alter table public.events enable row level security;

create policy "Users can view own colony events" on public.events for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can manage own colony events" on public.events for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create index events_colony_id_idx on public.events(colony_id);
create index events_active_idx on public.events(is_active) where is_active = true;

-- Pending events policies
alter table public.pending_events enable row level security;

create policy "Users can view own pending events" on public.pending_events for select using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create policy "Users can manage own pending events" on public.pending_events for all using (
  colony_id in (select id from public.colonies where user_id = auth.uid())
);

create index pending_events_colony_id_idx on public.pending_events(colony_id);
create index pending_events_processed_idx on public.pending_events(processed) where processed = false;

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

-- Function to initialize new colony
create or replace function public.initialize_colony(
  colony_name text,
  location_id uuid
) returns uuid as $$
declare
  new_colony_id uuid;
  resource_type text;
begin
  -- Create colony
  insert into public.colonies (user_id, name, location_id)
  values (auth.uid(), colony_name, location_id)
  returning id into new_colony_id;

  -- Initialize resources
  -- Initialize basic resources
  foreach resource_type in array array['oxygen', 'water', 'energy', 'minerals', 'food', 'research_points']
  loop
    insert into public.resources (colony_id, type, amount, production_rate, consumption_rate)
    values (new_colony_id, resource_type, 100, 0, 0);
  end loop;

  -- Initialize advanced resources (start at 0)
  foreach resource_type in array array['consumer_goods', 'rare_metals', 'databanks', 'nanomaterials']
  loop
    insert into public.resources (colony_id, type, amount, production_rate, consumption_rate)
    values (new_colony_id, resource_type, 0, 0, 0);
  end loop;

  return new_colony_id;
end;
$$ language plpgsql security definer;

-- Combat system tables
create table public.units (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references public.colonies(id) on delete cascade not null,
  unit_type text not null check (unit_type in ('marine', 'exosuit', 'sniper', 'medic', 'rocketeer', 'engineer', 'wall', 'turret', 'alien_worm', 'alien_spitter', 'alien_bug', 'drone', 'aa_turret', 'shock_trooper', 'flamethrower', 'scout_drone', 'scavenger_buggy', 'gatling_rover', 'plasma_tank', 'missile_buggy', 'gunship', 'emp_drone', 'minelayer_rover', 'siege_tank', 'railgun_walker', 'drone_carrier', 'cryo_tank', 'shield_emitter', 'interceptor', 'hacker_rover', 'artillery_crawler', 'titan_mech', 'behemoth_tank', 'ion_crawler', 'goliath_gunship', 'mobile_factory', 'sonic_devastator', 'radar_zepplin', 'stealth_operative', 'hologram_projector', 'gravity_manipulator', 'nanite_generator', 'bounty_hunter', 'grenadier', 'heavy_gunner', 'sapper', 'officer', 'jetpack_trooper')),
  tier integer default 1 check (tier between 1 and 4),
  upgrade_path text[] default '{}',
  hp_current integer not null,
  grid_x integer,
  grid_y integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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

-- RLS for units and battles
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

-- Recalculation RPC definition
create or replace function public.recalculate_resources(
  p_colony_id uuid
) returns setof public.resources as $$
declare
  v_elapsed_hours numeric;
  v_now timestamp with time zone := now();
begin
  -- Get elapsed time since last calculation
  select extract(epoch from (v_now - last_calc_at)) / 3600.0
  into v_elapsed_hours
  from public.colonies
  where id = p_colony_id;

  -- Skip if less than 1 second
  if v_elapsed_hours is null or v_elapsed_hours < 1.0 / 3600.0 then
    return query select * from public.resources where colony_id = p_colony_id;
    return;
  end if;

  -- Update ALL resources in a single statement
  update public.resources
  set amount = greatest(0, amount + (production_rate - consumption_rate) * v_elapsed_hours),
      updated_at = v_now
  where colony_id = p_colony_id;

  -- Update last_calc_at
  update public.colonies
  set last_calc_at = v_now,
      updated_at = v_now
  where id = p_colony_id;

  -- Return updated resources
  return query select * from public.resources where colony_id = p_colony_id;
end;
$$ language plpgsql security definer;

-- Atomic transaction for building placement: resource check, deduction, and building creation.
create or replace function public.create_building_transaction(
  p_colony_id uuid,
  p_building_type text,
  p_building_name text,
  p_x integer,
  p_y integer,
  p_costs jsonb,
  p_group_id text default null
) returns jsonb as $$
declare
  r_type text;
  r_cost numeric;
  v_available numeric;
  v_inserted_row public.buildings%rowtype;
begin
  -- 1. Lock resource rows and check if balance is sufficient
  for r_type, r_cost in select * from jsonb_each_text(p_costs) loop
    select amount into v_available from public.resources 
      where colony_id = p_colony_id and type = r_type for update;
      
    if v_available is null or v_available < r_cost::numeric then
      raise exception 'Недостаточно ресурса %: требуется %, доступно %', r_type, r_cost, coalesce(v_available, 0);
    end if;
  end loop;

  -- 2. Deduct resources atomically by subtraction
  for r_type, r_cost in select * from jsonb_each_text(p_costs) loop
    update public.resources 
      set amount = amount - r_cost::numeric
      where colony_id = p_colony_id and type = r_type;
  end loop;

  -- 3. Insert building
  insert into public.buildings (colony_id, type, name, level, is_active, x, y, group_id)
    values (p_colony_id, p_building_type, p_building_name, 1, true, p_x, p_y, p_group_id)
    returning * into v_inserted_row;

  return jsonb_build_object(
    'success', true,
    'building', row_to_json(v_inserted_row)::jsonb
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;

-- Optimization Indexes
create index if not exists units_colony_id_idx on public.units(colony_id);
create index if not exists battles_attacker_colony_id_idx on public.battles(attacker_colony_id);
create index if not exists battles_defender_colony_id_idx on public.battles(defender_colony_id);
