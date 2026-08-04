# Combat ECS Runtime

The active batch-movement and batch-targeting sequences are tracked in
`docs/combat-ecs-v4-batch-movement.md` and
`docs/combat-ecs-v4-batch-targeting.md`. The v3 plan remains as historical
optimization context.

Simulation version 4 uses the in-repository ECS runtime exclusively. The public
simulation API no longer exposes an engine selector or legacy array runtime.
Version 4 adds immutable movement frames and a deterministic batch commit while
keeping action resolution and seeded replay ordering canonical ECS concerns.

## World Model

`CombatWorld` assigns monotonically increasing numeric entity IDs. IDs are not
reused during a battle. Runtime data is exposed through grouped component stores:

- identity and transform;
- vitality and defense;
- combat, weapon, and targeting;
- movement and status/control;
- support, lifecycle, and mechanics.

Component stores are canonical while ECS phases execute. No facade-to-component
or component-to-facade synchronization API remains. Production systems create
units and hazards through explicit structural commands so they receive
monotonic entity IDs at deterministic flush points.
External string IDs are allocated by a battle-scoped monotonic allocator and
reserved before structural creation. Component data and hazards are deep-copied
at the world boundary, so later mutations of factory input cannot alter a running
battle. Runtime target, owner, ramp, melee, and movement relations use
`EntityId`; the snapshot codec is the only place that converts them to or from
external string IDs.
Component schemas are declared explicitly in `combat.unit-*-components.ts`.
`SimUnit` is a flat `UnitSnapshot` alias used only for factory input, initial
state, survivors, and replay serialization. It is not runtime storage.
`COMPONENT_FIELDS_ARE_EXHAUSTIVE` makes missing component-to-snapshot mappings a
compile-time error.

## Unit Compilation

`UNIT_TYPES` is a design catalog and is read only before structural creation.
Every deployment and summon is described by a typed `UnitBuildSpec` and passes
through the same pipeline:

`Unit definition + rank + upgrades + spawn policy + overrides -> compileUnit() -> UnitEntityBundle`

Squads compile directly into bundles before they enter `CombatWorld`. Spawn,
periodic-spawn, and trigger-spawn systems use the same compiler and explicitly
select `inheritance: 'base'`, preserving the current rule that summons do not
inherit owner rank or upgrades. The compiler also supports explicit owner-rank,
owner-loadout, and selected-upgrade policies for future unit mechanics.

Compiled bundles own combat stats, capabilities, primitives, and immutable
runtime rules. ECS systems read those components exclusively; no module under
`combat/ecs` imports or queries `UNIT_TYPES`. Dynamic statuses remain runtime
state and are applied after compilation. Clones copy compiled rules from their
source entity instead of recompiling from the catalog.

Registered component queries start from the smallest participating store and
cache stable result sets until structure or alive-state revisions change.
Optional mechanics are represented by capability marker components, including
support auras, periodic abilities, fields, formation bonuses, control beams,
transforms, growth/charge, burrow regeneration, triggers, reassembly, and
periodic spawning. Systems therefore do not scan every unit merely to discover
whether an optional configuration exists.

`EntitySpatialIndex` is team-aware and maintained incrementally for movement,
team changes, deaths, summons, clones, and hazards. Actor targeting uses a
separate immutable packed frame with a live dirty-entity delta and reusable
candidate buffers. Broad local mechanics query only intersecting buckets and
preserve stable external-ID tie-breaking.

## Migration Status: Complete

The ECS implementations currently own status scheduling, hazards, targeting,
mixed-size melee reservation, positioning, steering, formation cohesion,
movement state, burrow regeneration, spatial updates, direct healing actions, batch collision resolution,
single-shot local damage modifiers and simple weapon deaths, terminal outcome, initiative,
modifier/lifetime ticking, stat-growth and attack-charge accumulation,
periodic spawner and reassembly ownership,
typed component/resource stores, deterministic
entity queries, and snapshot/survivor serialization.

Combat metrics now read identity, vitality, targeting, movement, and transform
components directly. Tick orchestration passes `EntityId` values and rebuilds
only the canonical `EntitySpatialIndex`.
Trigger event selection and every trigger payload use component stores and
EntityId references.
Turn order, modifier ticking, target selection, melee reservation, spawning,
actions, and movement now pass only `EntityId` values between the tick
orchestrator and ECS runtime. Flat unit objects exist only at structural factory
input and immutable output snapshot boundaries.
Movement and healing read and write component stores directly through
`EntityId`. Every action family now stays inside the ECS runtime. Unsupported
weapon configurations fail explicitly
instead of delegating to the legacy weapon pipeline. The native damage path handles armor, supported combat
statuses, rank modifiers, movement reduction, target marks, flat block, shields,
reactive armor, execute, lifesteal, finite/reduction barriers, projectile
interception, deterministic damage sharing, movement charge, same-target ramp,
percent-HP payloads, on-hit statuses, and squad-wide target marks. Weapon
line-pierce, cone, beam, barrage, radial AoE, chain, conditional cluster attacks,
sweep, split-fire, side weapons, post-hit pull/knockback displacement, minimum
range, short-range melee hits, siege stance action setup, and ground-for-action
mobility mode changes also run natively. Burrowed attackers surface through the
native action setup; one-shot emerge damage and expanded radial AoE payloads are
consumed by the ECS damage path. Movement stealth now breaks natively after the
primary damage or interception and before on-hit and secondary weapon effects.
Burrow regeneration now reads movement/vitality components, applies actual
healing through the ECS healing kernel, and emits only the contractual
`burrow_regen` replay action in stable external-ID order.
Sequential multishot actions run through the same native per-shot pipeline and
stop immediately when the primary target dies. Accumulated attack charge is
released natively after other primary modifiers and is consumed by only the
first shot in a series. Pre-action stat growth and attack-charge accumulation
now mutate combat, vitality, and lifecycle components in stable external-ID
order before burrow regeneration. Battle-start and HP-threshold transform modes
now mutate transform, vitality, combat, weapon, and status components natively
in stable external-ID order, including one-time role swaps, flight changes, and
jump displacement. Growth/charge, burrow regeneration, and transform runtime
boundaries no longer copy facade state into components or mirror native results
back to facades. Periodic field scheduling and trigger field payloads now
share one ECS kernel for finite and reducing barriers, hazard cleansing, allied
status cleansing, and persistent hazards. The field runtime boundary reads
canonical transform, support, vitality, status, and targeting stores without a
unit-facade import. Adjacency formation bonuses now use
local EntityId spatial queries and the shared ECS status kernel in stable
external-ID order. Their runtime boundary reads canonical positions, formation
configuration, and status state without importing the unit facade. Control beams now acquire locally and own progress, stale
link breaks, conversion, target-reference clearing, and actual conversion
healing in ECS. The control runtime boundary reads canonical beam configuration,
positions, combat stats, vitality, and progress without a facade import.
Periodic ability scheduling, target policies, charges, damage,
status, hazard, shield, healing, spawn, and mark payloads now run through
native ECS kernels. The periodic runtime boundary preserves structural flush,
EntityId target references, seeded RNG, and local spatial queries without
importing the unit facade. Global mass shields, EMP, orbital hazards, and actual mass
healing now operate on canonical components at their contractual trigger ticks.
Their runtime boundary reads and writes canonical component stores directly.
Support auras now use local EntityId queries, ECS combat-tag filters, actual
shield deltas, and shared status/cleanse kernels. Their runtime boundary rebuilds
the spatial index from canonical components without importing the unit facade.
Successful incendiary hits create seeded napalm hazards
through the ECS structural buffer after primary on-hit effects; multishot creates
one puddle per non-intercepted shot. Smoke actions now deploy seeded suppression
hazards through a native ECS action path without primary damage or movement
stealth break. Mine actions use the same structural path while preserving mine
source attribution and their priority over smoke actions. Active spawn actions
now enforce owner caps and create fully prepared summons through the runtime
factory and ECS structural buffer.
Upgrade-driven periodic spawners now decrement their lifecycle timer and issue
seeded spawn commands through the ECS runtime. The spawn path keeps the
primary weapon and cooldown intact and no longer temporarily rewrites
`attackType`.
Configured on-kill cooldown resets, actual healing, and statuses now resolve
natively after a confirmed enemy death across primary and secondary hits.
Conditional air, ground, combat-tag, and rank ranges are target-aware in both
ECS positioning and action setup, including sequential modifier stacking.
Seeded on-death puddles now spawn after confirmed ECS weapon deaths with stable
source attribution, damage payloads, replay order, and structural buffering.
Replicate-on-kill clones capture component-native clone data and capability
markers at the victim position. They enter the same seeded structural lifecycle
before death puddles without serializing through a `SimUnit` snapshot.
Attack-count and damage-taken triggers with status, shield, heal, damage, spawn,
field, delayed-reassembly, or cooldown payloads now run natively after primary
damage. Direct damage supports configured percent HP, deterministic radial
selection, the shared damage pipeline, and trigger death attribution.
HP-threshold triggers with the same payload set run in an EntityId post-hazard
phase.
Kill triggers with the same payload set now execute after
configured on-kill effects and before replication or death hazards.
Death triggers execute immediately after the death
replay action and before any killer-owned effects.
Trigger spawn payloads now share the runtime unit factory, seeded IDs, owner and
source caps, HP scaling, replay contract, and structural command buffer.
Delayed-reassembly trigger payloads now schedule bounded vitality state and
source attribution natively. Reassembly countdown, completion resets, replay
events, and pending-team elimination protection now run inside the selected
runtime; ECS reads canonical vitality state without a `SimUnit` round trip.
Trigger fields now create finite or reducing barriers, cleanse hazards and
harmful allied statuses, or buffer persistent hazards through EntityId stores.
Trigger capability gates and their facade fallback have been removed now that
every configured event and payload is native. The post-hazard HP-threshold phase
always reads canonical vitality/lifecycle stores in stable external-ID order.
The shared tick orchestrator passes tick, replay actions, and seeded RNG directly
to the ECS runtime without constructing a facade `TriggerContext`.
Terminal outcome resolution also owns its runtime state: ECS queries canonical
unit and hazard components after flushing structural commands, so the engine no
longer passes the runtime's hazard facade back into it.
The global status phase likewise consumes canonical vitality and status stores
directly; it no longer performs a full facade import before periodic scheduling
and death resolution.
Native hazard processing rebuilds its spatial index from canonical transforms,
vitality, and hazard components without importing unit or hazard facades at the
end of each combat tick. Actor-turn completion no longer imports replay-linked
facade objects into component stores. Hazard cleansing queries canonical hazard
entities and removes them structurally in deterministic reverse-creation order.
The tick orchestrator tracks the monotonic entity watermark around each action
and inserts newly created live unit entities into the canonical spatial index.
This also captures clones or summons created by nested trigger/death flushes
without reading roster length or unit facade objects.
Action, movement, targeting, and support-aura runtime contexts no longer expose
the legacy object-based spatial hash.
`CombatRuntime` no longer exposes mutable unit or hazard facade arrays. Tests
that exercise structural creation use the explicit `CombatWorld` boundary.
Runtime and phase boundaries no longer mirror component results into unit or
hazard facade views.
The production array-based action executor and periodic spawner have been
deleted. Behavioral tests construct `CombatWorld` directly and assert canonical
component state, replay actions, and structural flush results. No test-only
compatibility executor or legacy oracle remains.
The legacy array death/spawn utilities and their unreachable conditional weapon
handlers have also been removed. Death and spawn fixtures now invoke the native
ECS resolvers.
Unreachable array phase implementations for global effects, growth/charge,
periodic abilities, transforms, turn order, and depenetration have been deleted.
Their regression contracts now target the corresponding ECS systems directly.
ECS death causes, hack-mode priority, and status normalization now live in
object-free core contract modules. Squad creation imports aura configuration
without loading the old aura processor, and tick orchestration no longer exports
an unused facade post-hazard hook. Consequently the production engine import
graph does not reach the legacy object damage/death/control/status/trigger graph.
The compatibility roster and hazard arrays, their proxy storage, and entity
object-view getters have been removed from `CombatWorld`. Unit creation, hazard
creation, cloning, and summon cap checks use component-native world APIs.
Tests enqueue structural commands explicitly and inspect immutable canonical
snapshots after deterministic flush points.
ECS action, damage, death, trigger, displacement, and movement systems likewise
write only component stores; all component-to-facade synchronization APIs have
been removed from `CombatWorld`.
The targeting-phase boundary also flushes structural commands, resolves
EntityId references, and rebuilds the spatial index directly from canonical
components without a roster-facade import.
Replay snapshots and survivor serialization flush pending structural commands
and clone canonical components directly; facade state is never imported before
building battle output.
Periodic burn, acid, and degeneration deaths now resolve inside the ECS status
phase, including source-less deaths, resurrection, reassembly, and death/kill
triggers. Mine and periodic hazard deaths use the same resolver without
round-tripping through unit or hazard facades. Environmental deaths always use
component resolution; the engine no longer constructs or passes death callbacks
across this boundary.
Initial squads, action spawns, trigger clones, and hazards enter a deterministic
structural command buffer. Target references and melee
sectors use `EntityId`; external string IDs remain only in serialized snapshots
and replay actions. All combat phases, actions, movement, damage, death,
targeting, hazards, support effects, and termination now use component stores
directly. There is no alternate object-runtime execution path.

## Completion Invariants

- `createEcsCombatRuntime()` is the only production `CombatRuntime`.
- ECS systems do not import `SimUnit`; they read typed component stores.
- `SimUnit` aliases `UnitSnapshot` and is restricted to factories, structural
  input, initial state, survivors, and replay output.
- All structural mutations pass through `StructuralCommandBuffer`.
- Runtime relations use `EntityId`; string references exist only at factory and
  replay/snapshot boundaries.
- Optional mechanics are selected through capability components and registered
  cached queries.
- `EcsCombatPhaseScheduler` is the single ordered registry for pre-action and
  post-action phases.
- All behavioral tests invoke `CombatWorld` or the public simulator directly;
  no compatibility executor or object-runtime oracle exists.
- CI must pass the full Vitest suite, TypeScript, and architecture limits.

## Runtime Creation

Configuration-backed units use `createRuntimeUnitFromConfig()` for scale
normalization and primitive preparation. Initial configuration rows are expanded
by `createRuntimeSquad()`. Spawn attacks, periodic spawns, trigger spawns,
decoys, and initial squads share the factory path. Replication clones copy
canonical components and capability markers directly; resurrection and
reassembly mutate their existing entity instead of creating a replacement.

Simulation scale is applied once:

- speed: config value multiplied by 15;
- range and configured radii: config value multiplied by 40;
- runtime values passed to clone operations remain in simulation scale.

## Tick Phases

`EcsCombatPhaseScheduler` owns the deterministic order. `runStage()` executes the
registered list; `runPhase()` exposes the same definition for focused tests.

Pre-action phases are:

1. Reassembly.
2. Global effects.
3. Support auras.
4. Growth and attack charge.
5. Burrow regeneration.
6. Transform modes.
7. Field effects.
8. Formation bonuses.
9. Control beams.
10. Periodic abilities.
11. Structural flush.
12. Status scheduling and periodic ticks.

The engine then resolves terminal state, builds speed-first team-interleaved
initiative, alternating the starting team of equal-speed groups by tick, and
runs modifier, targeting, melee-sector, action, and spawn systems for each
actor. Actors enqueue movement requests against the same
immutable frame. The `batch_movement` phase builds one bounded same-team
neighbor graph, derives all intents, runs one deterministic Jacobi collision
pass, and commits changed transforms and spatial cells together. Forced
displacement from attacks remains immediate. Post-action phases are hazard
resolution and HP-threshold triggers, followed by replay and metric capture.
One primary collision pass is intentional: a second unconditional pass changed
the Tier 1 role matrix and delayed contact without a proportional overlap gain.
Phases requiring randomness fail without the battle's seeded PRNG.

Periodic statuses own `tickInterval` and `nextTickIn`. A duration-30 effect with
interval 10 ticks executes exactly at 10, 20, and 30 before it expires.

## Health And Death

`applyEcsHealing()` records actual restored HP, never requested overheal.
`resolveEcsDeath()` is the only production death path and receives source
and cause. It owns resurrection, reassembly, death triggers, kill credit, kill
triggers, death hazards, replication, and the final replay `die` action.
The resolver handles one-time resurrection and configured reassembly before
resolving EntityId death triggers. Trigger damage propagates `cause: trigger`
through direct and shared damage deaths.

Expiration is a non-combat death cause. It does not grant kill credit or execute
death/kill triggers. Temporary-unit expiration resolves directly in the ECS
modifier phase. The modifier boundary reads canonical cooldown, lifetime,
defense, status, and trigger state without importing the unit facade. DoT, mine,
hazard, trigger, and weapon deaths keep their source attribution when a source
entity exists. There is no object-runtime death callback or facade mirror.

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

### Squad designation

Shared target marks are indexed by source entity. Normal acquisition remains
local, while a marked squad may contribute candidates inside its explicit assist
radius. A new squad designation may shorten allied aggro locks without deleting
current targets; refreshes do not cause global target churn. Each source owns one
active designation, separate sources may designate separate squads, and a target
stores only one effective mark so damage multipliers never stack.

Combat and replay metrics expose first mark tick, uptime, unique squads,
designation switches, refreshes, assisted shots, utilization, marked damage,
bonus damage, retarget requests, and marked overkill. Simulation version 6
introduces this targeting and replay-action contract.

## Termination

`simulateBattle()` reports `terminationReason`, `elapsedTicks`, and
`simulationVersion` on every result. Supported timeout policies are:

- `draw`: simulator and QA default, 400 ticks unless overridden;
- `defender_holds`: PvP default, 1000 ticks.

Elimination, mutual elimination, and detected no-damage stalemates terminate
before the timeout limit.

## Replay Compatibility

New snapshots are written with simulation version 4. Stored replay responses are
validated with Zod before reaching the renderer:

- version 4 is current and rendered normally;
- versions 2 and 3 remain playable through the stable replay log/snapshot
  boundary and are visibly labelled as approximate historical visualizations;
- version 1, invalid versions, and versions newer than the current engine are
  rejected as unsupported instead of being silently re-simulated;
- malformed payloads for otherwise playable versions never reach the renderer.

Compatibility is a presentation guarantee, not a promise that a v2 or v3 battle
would produce identical results if re-simulated by the v4 engine.

## Verification And Profiling

Deterministic scenario contracts cover winner, termination, replay actions,
survivors, and metrics. Mirror gates swap teams and field coordinates to expose
initiative or ID bias.

With `{ profile: true }`, the result reports EntityId spatial query counts,
total local candidates, and maximum candidates in one query. Packed targeting
reports frame builds, acquisitions, bucket candidates, live-delta candidates,
scratch growth, and build/query/selection time. Broad weapon shapes, auras,
hazards, projectile interception, and damage sharing retain local spatial
queries. Batch movement reports movement requests, bounded neighbor
candidates/edges, collision candidates/overlaps, and dirty cells.

The checked-in v4 benchmark uses seed `24680`, eleven production runs for
`massive_clash`, seven for `zerg_rush`, and five diagnostic runs. Production
mode disables counters and is the player-facing measurement:

| Preset | Units | v4 ticks | v4 production | v3 production | Total change | Time/tick change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `massive_clash` | 100 | 82 | 117.74 ms | 174.75 ms | -32.6% | -36.7% |
| `zerg_rush` | 605 | 205 | 3009.14 ms | 3770.80 ms | -20.2% | -46.3% |

The simultaneous movement contract can change contact timing and therefore
elapsed ticks. The 605-unit battle uses 48.6% more ticks than v3, so per-tick
cost is the cleaner engine signal. Neighbor plus collision candidates per tick
fell by about 60% in that preset. Packed fixed-grid buckets and flat top-32
neighbor heaps remove the remaining `Map` and per-edge object cost. The original
three-second target is now within normal benchmark noise without changing roles.

Wall-clock timing is environment-sensitive; candidate counts, cache hits, and
deterministic replay/scenario contracts are the primary regression signals.
