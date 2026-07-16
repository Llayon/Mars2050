# Combat ECS Runtime

Simulation version 2 uses the in-repository ECS runtime by default. The legacy
array engine remains selectable only for deterministic shadow comparison.

## World Model

`CombatWorld` assigns monotonically increasing numeric entity IDs. IDs are not
reused during a battle. Runtime data is exposed through grouped component stores:

- identity and transform;
- vitality and defense;
- combat, weapon, and targeting;
- movement and status/control;
- support, lifecycle, and mechanics.

The current migration adapter keeps a plain `SimUnit` view synchronized with
component stores. This lets existing focused systems migrate independently
without paying a per-property Proxy cost in combat hot loops. New entities must
enter through `world.roster.push()` so they receive an entity ID and components.

## Runtime Creation

All units use `createRuntimeUnitFromConfig()` for scale normalization and
primitive preparation. Initial configuration rows are expanded by
`createRuntimeSquad()`. Spawn attacks, periodic spawns, trigger spawns, clones,
decoys, resurrection/reassembly, and initial squads share the same factory path.

Simulation scale is applied once:

- speed: config value multiplied by 15;
- range and configured radii: config value multiplied by 40;
- runtime values passed to clone operations remain in simulation scale.

## Tick Phases

The deterministic order is:

1. Rebuild the spatial hash.
2. Process globals, auras, transforms, periodic abilities, reassembly, and spawns.
3. Insert newly created entities into the spatial hash.
4. Tick all statuses in a separate global status phase.
5. Resolve terminal elimination or stalemate.
6. Build speed-first, team-interleaved initiative.
7. Tick unit modifiers, target, reserve melee sectors, act, or move.
8. Resolve hazards, post-hazard mechanics, and depenetration.
9. Record replay actions and metrics.

Periodic statuses own `tickInterval` and `nextTickIn`. A duration-30 effect with
interval 10 ticks exactly at 10, 20, and 30 before it expires.

## Health And Death

`applyHealing()` records actual restored HP, never requested overheal.
`resolveUnitDeath()` is the only production death path and receives source and
cause. It owns resurrection, reassembly, death triggers, kill credit, kill
triggers, death hazards, replication, and the final replay `die` action.

Expiration is a non-combat death cause. It does not grant kill credit or execute
death/kill triggers. DoT, mine, hazard, trigger, and weapon deaths keep their
source attribution when a source entity exists.

## Damage Contract

The operation order is contractual and covered by `combat.damage-order.test.ts`:

1. Attack boost and percent-HP payload.
2. Projectile interception.
3. Armor break, armor pierce, and defense.
4. Output suppression and deterministic accuracy.
5. Air/ground, rank, and anti-summoner multipliers.
6. Movement reduction.
7. Finite barriers and field reduction.
8. Vulnerability and damage-reduction statuses.
9. Target mark amplification.
10. Flat damage block.
11. Shield and shield-hit block.
12. Reactive armor and damage sharing.
13. Execute, actual lifesteal, HP mutation, and death resolution.

Weapon loadouts allow one primary area geometry. Split fire and side weapons are
explicit secondary weapons. Invalid multi-geometry configurations fail during
runtime creation instead of stacking accidental primary attacks.

## Termination

`simulateBattle()` reports `terminationReason`, `elapsedTicks`, and
`simulationVersion` on every result. Supported timeout policies are:

- `draw`: simulator and QA default, 400 ticks unless overridden;
- `defender_holds`: PvP default, 1000 ticks.

Elimination, mutual elimination, and detected no-damage stalemates terminate
before the timeout limit.

## Verification And Profiling

`compareCombatEngines()` runs legacy and ECS from cloned inputs and compares
winner, termination, replay actions, and survivors with numeric tolerance.
Mirror gates swap teams and field coordinates to expose initiative or ID bias.

With `{ profile: true }`, the result includes spatial query count, total local
candidates, and maximum candidates in one query. Targeting, broad weapon shapes,
auras, hazards, projectile interception, and damage sharing use local queries
where a spatial hash is available.
