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
- Pending: full component-native source refs, team/status/summon indexes,
  component-native structural bundles, and scheduler-owned actor turns.
