# Combat ECS Runtime

Simulation version 2 uses the in-repository ECS runtime exclusively. The public
simulation API no longer exposes an engine selector or legacy array runtime.

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

## Migration Status

The ECS implementations currently own status scheduling, hazards, targeting,
mixed-size melee reservation, positioning, steering, formation cohesion,
movement state, burrow regeneration, and spatial updates, direct healing actions, depenetration,
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
orchestrator and ECS runtime. The remaining facade use is limited to structural
factory input and compatibility snapshots.
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
Their runtime boundary no longer imports facade identity, position, vitality, or
status before execution and only mirrors changed vitality/status results back.
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
Replicate-on-kill clones are built from canonical ECS snapshots at the victim
position and enter the same seeded structural lifecycle before death puddles.
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
deleted. Behavioral tests that still use their historical call shape execute
the native ECS action system through a test-only harness; this preserves their
scenario fixtures without retaining a second combat implementation.
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
sectors use `EntityId`; string IDs are written only as a compatibility mirror
for unported movement/action code. The migration is complete only when the
remaining hooks use component stores directly and the facade can be removed.

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

1. Rebuild the EntityId spatial index.
2. Process globals, auras, transforms, periodic abilities, reassembly, and spawns.
3. Insert newly created entities into the EntityId spatial index.
4. Tick all statuses in a separate global status phase.
5. Resolve terminal elimination or stalemate.
6. Build speed-first, team-interleaved initiative.
7. Tick unit modifiers, target, reserve melee sectors, act, or move.
8. Resolve hazards, post-hazard mechanics, and depenetration.
9. Record replay actions and metrics.

Periodic statuses own `tickInterval` and `nextTickIn`. A duration-30 effect with
interval 10 ticks exactly at 10, 20, and 30 before it expires.

## Health And Death

`applyEcsHealing()` records actual restored HP, never requested overheal.
`resolveEcsUnitDeath()` is the only production death path and receives source
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

## Termination

`simulateBattle()` reports `terminationReason`, `elapsedTicks`, and
`simulationVersion` on every result. Supported timeout policies are:

- `draw`: simulator and QA default, 400 ticks unless overridden;
- `defender_holds`: PvP default, 1000 ticks.

Elimination, mutual elimination, and detected no-damage stalemates terminate
before the timeout limit.

## Verification And Profiling

Deterministic scenario contracts cover winner, termination, replay actions,
survivors, and metrics. Mirror gates swap teams and field coordinates to expose
initiative or ID bias.

With `{ profile: true }`, the result reports EntityId spatial query counts,
total local candidates, and maximum candidates in one query. Targeting, broad
weapon shapes, auras, hazards, projectile interception, and damage sharing use
local component queries.
