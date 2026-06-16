# MechaBellum Combat System for Mars2050

## Concept

Async auto-battler where players train mech squads, deploy them against NPC outposts (PvE) and later other players (PvP). Battles resolve automatically based on unit composition, stats, and type counters -- similar to MechaBellum / Auto Chess. No real-time input during combat.

---

## Core Mechanics

### Unit Types (6 mech classes)

| Unit | Role | ATK | DEF | HP | SPD | Range | Cost (minerals/energy) | Counter |
|------|------|-----|-----|----|-----|-------|----------------------|---------|
| Scout | Fast flanker | 8 | 3 | 40 | 9 | 2 | 40/20 | Artillery |
| Assault | Balanced DPS | 14 | 6 | 80 | 5 | 3 | 80/40 | Heavy |
| Heavy | Tank | 10 | 14 | 150 | 2 | 2 | 120/60 | Assault |
| Artillery | Ranged AoE | 20 | 2 | 50 | 3 | 6 | 100/80 | Scout |
| Support | Healer/buffer | 4 | 5 | 60 | 6 | 3 | 90/50 | Assault |
| Commander | Squad buff | 12 | 8 | 100 | 4 | 3 | 150/100 | Artillery |

**Counter system**: dealing 1.5x damage to countered type, receiving 0.75x from it.

### Squad Composition

- **Max 6 units** per squad (3 front row, 3 back row)
- Front row: melee/close-range priority targets
- Back row: ranged units, protected by front
- **Synergy bonuses**: 2+ same type = +15% to that type's primary stat (e.g., 2 Assaults = +15% ATK)

### Battle Resolution (auto-battler rounds)

1. **Initiative**: sort all units by SPD (ties: attacker goes first)
2. **Each round**: unit picks target (front row first, lowest HP), attacks
3. **Damage formula**: `dmg = ATK * (1 + counter_bonus) - DEF * 0.5`, minimum 1
4. **End condition**: all units on one side destroyed, or draw after 15 rounds
5. **Battle log**: array of round results for UI replay

### PvE Outposts

- Map locations get an `outpost_squad` (auto-generated based on difficulty 1-5)
- Difficulty scales unit count and tier:
  - Diff 1: 2 Scouts
  - Diff 2: 3 mixed (Scout + Assault)
  - Diff 3: 4 mixed (Assault + Heavy)
  - Diff 4: 5 mixed (Assault + Heavy + Artillery)
  - Diff 5: 6 full squad (all types)
- Defeating an outpost: permanent control, passive resource bonus, one-time loot
- Failed attack: lose 50% of deployed units (returned damaged, not destroyed)

### Timed Travel

- Attack uses `pending_events` (already has `attack_arrive` type)
- Travel time: `distance * 30 seconds` (1 min per tile)
- Player can recall before arrival (no losses)

---

## Architecture

### New Domain: `combat`

```
src/domains/combat/
  combat.types.ts       -- BattleResult, BattleRound, UnitInstance, CombatSquad
  combat.config.ts      -- UNIT_TYPES definitions, counter matrix, synergy rules
  combat.engine.ts      -- Pure function: resolveBattle(attacker, defender) => BattleResult
  combat.service.ts     -- Orchestrate attack: validate, travel, resolve, apply results
  combat.schemas.ts     -- Zod schemas for API input
  index.ts
```

### New Domain: `army`

```
src/domains/army/
  army.types.ts         -- ArmyUnit row, TrainOrder, ArmySquad
  army.config.ts        -- Training costs, times, max squad size
  army.service.ts       -- Train, list, assign to squad, repair units
  army.schemas.ts       -- Zod schemas
  index.ts
```

### DB Schema Changes (new migration)

```sql
-- Army units (individual unit instances owned by a colony)
create table public.army_units (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references colonies(id) on delete cascade,
  unit_type text not null, -- scout, assault, heavy, artillery, support, commander
  level integer default 1,
  hp integer not null,     -- current HP
  max_hp integer not null,
  status text default 'idle' check (status in ('idle', 'training', 'deployed', 'damaged')),
  created_at timestamptz default now()
);

-- Squad slots (6 per colony: 3 front, 3 back)
create table public.squad_slots (
  id uuid default uuid_generate_v4() primary key,
  colony_id uuid references colonies(id) on delete cascade,
  position integer check (position between 0 and 5),
  unit_id uuid references army_units(id) on delete set null,
  unique(colony_id, position)
);

-- Battle log
create table public.battle_log (
  id uuid default uuid_generate_v4() primary key,
  attacker_colony_id uuid references colonies(id),
  defender_colony_id uuid,  -- null for PvE
  defender_location_id uuid references map_locations(id), -- null for PvP
  is_pve boolean not null,
  result text check (result in ('attacker_win', 'defender_win', 'draw')),
  rounds jsonb not null,
  attacker_losses jsonb,
  defender_losses jsonb,
  loot jsonb,
  created_at timestamptz default now()
);

-- Map outposts (PvE defenders tied to locations)
alter table map_locations add column outpost_squad jsonb default null;
alter table map_locations add column controlled_by uuid references colonies(id);

-- Extend pending_events check constraint to include 'combat_resolve'
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/army` | GET | List all army units for colony |
| `/api/army/train` | POST | Train a new unit (costs resources, adds to pending_events) |
| `/api/army/squad` | PUT | Assign units to squad slots |
| `/api/combat/attack` | POST | Launch attack on outpost or player |
| `/api/combat/result` | GET | Get battle log / history |

### New Hooks + Components

| File | Purpose |
|------|---------|
| `hooks/useArmy.ts` | Train units, list army, manage squad |
| `hooks/useCombat.ts` | Launch attacks, poll results |
| `components/screens/ArmyScreen.tsx` | Full-screen army management (new tab or sub-screen) |
| `components/screens/BattleScreen.tsx` | Battle replay / results view |
| `components/screens/CombatTargetPicker.tsx` | Pick outpost on map to attack |

---

## Implementation Phases

### Task 1: Combat Engine (pure logic, no DB)

- Create `domains/combat/combat.types.ts` with all type definitions
- Create `domains/combat/combat.config.ts` with UNIT_TYPES, counter matrix, synergy rules
- Create `domains/combat/combat.engine.ts` -- pure `resolveBattle()` function
- Write vitest tests for engine: counter math, synergy, round resolution, edge cases (empty squad, draw)

### Task 2: Army Domain (DB + service)

- Write DB migration for `army_units`, `squad_slots`, `battle_log` tables + RLS
- Create `domains/army/army.types.ts`, `army.schemas.ts`, `army.config.ts`
- Create `domains/army/army.service.ts` (train, list, assign squad, repair)
- Create API routes: `/api/army`, `/api/army/train`, `/api/army/squad`
- Create `hooks/useArmy.ts`

### Task 3: Combat Service (orchestration)

- Create `domains/combat/combat.service.ts` -- validate attack, create pending_event, resolve on completion
- Extend `pending_events` processing for `combat_resolve` type
- Create `/api/combat/attack` and `/api/combat/result` routes
- Create `hooks/useCombat.ts`

### Task 4: PvE Outpost System

- Extend `map_locations` with `outpost_squad` and `controlled_by`
- Create outpost generator function (difficulty -> squad composition)
- Wire combat resolution with outpost defeat (loot + control + resource bonus)
- Update `map.service.ts` to show outpost info on discovered locations

### Task 5: UI -- Army Management

- Create `ArmyScreen.tsx` (view units, train new mechs, assign squad)
- Integrate into `BottomNav` (replace or add tab) or as sub-screen from BuildingsScreen
- Show unit stats, costs, training queue

### Task 6: UI -- Combat + Battle View

- Create `CombatTargetPicker.tsx` (overlay on MapScreen to select outposts)
- Create `BattleScreen.tsx` (round-by-round battle log with results)
- Show attack travel timer (using pending_events realtime subscription)
- Integrate into OperationsScreen

### Task 7: PvP (future)

- Add ranked matchmaking via leaderboard score
- Extend combat service for PvP attacks (defender squad auto-deploys)
- Battle log for both players
- Push notifications on attack received (Telegram WebApp haptic feedback)

---

## Key Design Decisions

1. **Combat engine is a pure function** -- `resolveBattle(attacker: UnitInstance[], defender: UnitInstance[]) => BattleResult`. No DB calls, fully testable, deterministic with seeded random for critical hits.

2. **Units are persistent DB rows** -- each `army_units` row is a specific mech instance with HP, level, status. Lost units are gone (or damaged = needs repair time).

3. **Pending events for timing** -- attacks are not instant. `pending_events` handles travel + resolution timing, already supported by existing infrastructure.

4. **PvE outposts give passive income** -- controlling a location adds a production multiplier. This creates a resource sink (training army) and reward loop (more territory = more resources).

5. **Squad = 6 slots, not free-form** -- constrained squad building keeps balance manageable and UI simple for mobile/TWA.
