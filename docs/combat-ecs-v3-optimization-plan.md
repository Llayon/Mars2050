# Combat ECS v3 Optimization Plan

## Goal

Optimize deterministic battles with 100-600 units without changing balance,
the replay wire format, or existing v3 scenario results.

Target medians on the v3 baseline machine:

- `massive_clash`: at most 250 ms;
- `zerg_rush`: at most 3 seconds;
- one initial spatial rebuild;
- no cached component-query result copies.

## Delivery Slices

1. Freeze golden scenario fingerprints and split production from diagnostic
   benchmark modes. Disable detailed metrics and profiling in production PvP.
2. Replace runtime string provenance with canonical `EntityId` source
   references. Keep strings only in config, snapshot, and replay codecs.
3. Return readonly cached query views, add team/status/summon indexes, reuse the
   spatial index for collision pairs, and centralize position mutations.
4. Replace tick-path `SimUnit` structural payloads with owned component-native
   entity bundles and fully retire expired hazard entities.
5. Move actor turns into the ECS phase scheduler and remove the single-runtime
   adapter plus the unused `actorSynchronized` result flag.

## Compatibility

- Keep `CURRENT_SIMULATION_VERSION` at 3.
- Keep `simulateBattle()`, snapshots, battle actions, and API payloads stable.
- Existing v3 golden fingerprints must remain unchanged after every slice.
- Version 2 replay compatibility and its approximation warning remain intact.
- Harmful status damage from a hazard is a newly supported edge case; its owner
  receives kill credit only when the source resolves to a unit entity.

## Verification

- Source attribution covers units, hazard owners, source-less hazards,
  synthetic sources, expired hazards, and dead owners.
- Query caches cover structure, alive, team, and capability invalidation.
- Spatial collision pairs match a seeded brute-force oracle.
- Component-native creation preserves ownership isolation and snapshots.
- Final gates: full Vitest, TypeScript, architecture limits, five-run production
  and diagnostic benchmarks, Next.js production build, and Chromium simulator QA.

Wall-clock budgets are evaluated on the baseline machine. CI gates deterministic
fingerprints and structural counters rather than machine-dependent durations.

## Progress

- Slice 1 complete: five golden replay fingerprints, readonly component-query
  cache views, explicit production/profile benchmark modes, and production PvP
  diagnostics disabled.
- Source safety complete: periodic hazards retain their unit owner, hazard
  statuses propagate that owner, and environmental deaths reject non-unit
  source entities. Expired hazards now retire metadata and external-ID indexes.
- Collision broad phase now rejects impossible pairs before narrow-phase
  overlap math. Golden fingerprints remain unchanged.
- Intermediate three-run production medians: `massive_clash` 288.41 ms and
  `zerg_rush` 5106.66 ms. These are progress measurements, not final gates.
- Runtime provenance now uses canonical `EntityId` references for status damage,
  target marks, control progress, and hazard ownership. External strings remain
  only in configuration, snapshots, and replay actions; synthetic sources do
  not enter ECS relation storage.
- Status and control-progress phases now use structural active-state markers.
  Summon caps use a canonical ownership index, and outcome checks use a team
  membership index that stays synchronized through control conversion.
- After the index slice, diagnostic component candidate scans are 65.9% of the
  original baseline for `massive_clash` and 79.1% for `zerg_rush`. Three-run
  production medians were 291.33 ms and 5261.22 ms respectively.
- Depenetration now reuses the canonical spatial cells and is covered by a
  seeded brute-force pair oracle. Coordinate writes go through
  `CombatWorld.setEntityPosition()`, including movement, displacement and jump.
- Structural unit commands now carry owned component-native `UnitEntityBundle`
  payloads. The `SimUnit` compatibility adapter captures components, relations
  and capability markers once before the command enters the queue.
- Post-structural three-run medians were 290.88 ms for `massive_clash` and
  5271.42 ms for `zerg_rush`; tick traversal remains the next performance limit.
- The complete entity turn loop now runs as the scheduler-owned `actor_turn`
  action phase. `combat.engine.ts` only advances pre-action, action and
  post-action stages; targeting, modifiers, spawning, melee reservation,
  action resolution, structural flush and movement stay inside ECS orchestration.
- Legacy per-actor methods were removed from `CombatRuntime`; focused tests now
  invoke ECS systems directly. `RuntimeActionResult` contains only `acted`, and
  the unused `actorSynchronized` compatibility flag has been retired.
- Slices 2-5 and the functional final gates are complete. The production build
  passes, as do all 10 Chromium simulator QA scenarios. Five-run production
  medians are 285.61 ms for `massive_clash` and 5387.50 ms for `zerg_rush`;
  diagnostic medians are 352.00 ms and 5362.67 ms respectively.
- The 250 ms / 3 second targets remain open performance work. `zerg_rush`
  still traverses 8,898,041 spatial bucket candidates, so the next optimization
  should reduce targeting and movement spatial candidates without changing
  deterministic query order or replay fingerprints.
