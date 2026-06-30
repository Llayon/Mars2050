# Combat Domain — Mars2050

## Файлы домена
- `src/domains/combat/combat.engine.ts` — главный tick loop `simulateBattle`.
- `src/domains/combat/combat.config.ts` — unit configs and balance constants.
- `src/domains/combat/combat.types.ts` — DB/config-facing combat types and public re-exports.
- `src/domains/combat/combat.sim.types.ts` — runtime simulation types (`SimUnit`, `SimHazard`, `Obstacle`).
- `src/domains/combat/combat.actions.ts` — replay action/result types.
- `src/domains/combat/combat.targeting.ts` — sticky aggro, local acquisition, movement fallback.
- `src/domains/combat/combat.movement.ts` — flow/path movement plus steering integration.
- `src/domains/combat/combat.steering.ts` — separation, alignment, emergency depenetration.
- `src/domains/combat/spatial-hash.ts` — deterministic spatial index.
- `src/domains/combat/combat.systems.ts` — action, damage, heal, AoE, status application.
- `src/domains/combat/combat.systems.utils.ts` — death, clone, spawn helpers.
- `src/domains/combat/combat.status.ts` — deterministic status apply/tick/cleanse helpers.
- `src/domains/combat/combat.damage.ts` — defense, shield, status mitigation, lifesteal, and HP damage pipeline.
- `src/domains/combat/combat.auras.ts` — periodic shield, regen, reveal, and status auras.
- `src/domains/combat/combat.minefield.ts` — deterministic mine deployment.
- `src/domains/combat/combat.attack-geometry.ts` — line pierce and reusable attack geometry helpers.
- `src/domains/combat/combat.displacement.ts` — deterministic pull displacement.
- `src/domains/combat/combat.side-weapon.ts` — deterministic side weapon target selection.
- `src/domains/combat/combat.ramp.ts` — same-target focused-fire damage scaling.
- `src/domains/combat/combat.percent-damage.ts` — capped percent-HP anti-giant damage.
- `src/domains/combat/combat.projectile-defense.ts` — deterministic projectile interception.
- `src/domains/combat/combat.on-kill.ts` — deterministic on-kill effects.
- `src/domains/combat/combat.weapon-rules.ts` — shared weapon constraints such as minimum range.
- `src/domains/combat/combat.positioning.ts` — approach/back-away positioning decisions.
- `src/domains/combat/combat.deployment.ts` — attack/defense placement zones and validation.
- `src/domains/combat/combat.melee-engagement.ts` — melee engagement slot readiness.
- `src/domains/combat/combat.metrics.ts` — optional simulation metrics for simulator QA.
- `src/domains/combat/combat.upgrades.ts` — unit and global upgrade definitions.
- `src/domains/combat/combat.pathfinding.ts` — static obstacle flow field.

## UI / Renderer Layer
- `src/components/game/battle-replay-visuals.ts` — purely visual configuration (scale, anchor, hover, VFX scale, muzzle offsets). Kept strictly separated from `combat.config.ts` to preserve simulation determinism.

## Core Rules
- Seeded replay must be deterministic. Do not introduce unseeded randomness in the simulation path.
- Seed `0` is valid; use nullish fallback for optional seeds, not truthy checks.
- Keep candidate ordering deterministic. Spatial hash query order is part of replay stability.
- Normal units should not use full-map aggro. Full-map acquisition must be explicit for special long-range units.
- Use `UnitBaseStats.targetingProfile = 'global'` for explicit full-map acquisition; do not add hidden hardcoded unit lists in targeting code.
- Movement uses flow/pathfinding plus steering. Do not remove flow or facing/turn logic without regression tests.
- Keep runtime simulation types in `combat.sim.types.ts`; keep DB/config-facing types in `combat.types.ts`.

## Current Targeting Model
- Heal targeting scans allies directly.
- Attack targeting uses sticky `attackTargetId` and `aggroLockTicks`.
- Local acquisition uses spatial hash radius:
  - melee: fixed local radius.
  - ranged: `max(local radius, range + buffer)`.
  - special long-range units may acquire globally.
- If no local enemy is acquired, movement can use a global fallback target without setting aggro lock.

## Current Movement Model
- `combat.engine.ts` rebuilds `SpatialHash` at the start of each tick.
- Moving units call `spatialHash.update(unit)` after movement, so later units in the same tick query current positions.
- `combat.movement.ts` keeps flow-field navigation, turn speed, formation cohesion, obstacle push, and velocity smoothing.
- `combat.steering.ts` adds separation/alignment over nearby units.
- Fully overlapped unit pairs use deterministic opposite separation directions; do not make zero-distance push one-sided.
- `SpatialHash.update()` preserves initial insertion order; do not reinsert moved units in a way that changes replay ordering.

## Current Status / Damage Model
- Runtime statuses live in `combat.status.ts`; do not implement one-off status ticking in `combat.systems.ts`.
- Current status types are `emp`, `slow`, `burn`, `acid`, `vulnerable`, `range_suppressed`, `revealed`, `hacked`, `damage_reduction`, `regen`, `output_suppressed`, `armor_broken`, `degeneration`, and `haste`.
- Same stack identity refreshes duration and keeps the strongest value. Avoid unbounded duplicate status stacks.
- `emp` and `hacked` block active actions. `slow` and `haste` affect movement. `burn`, `acid`, `degeneration`, and `regen` tick every 10 simulation ticks.
- Damage must go through `applyCombatDamage()` in `combat.damage.ts`. Do not subtract HP directly in attack code except for explicitly modeled hazards/status ticks with tests.
- Shield overflow is intentional: shields absorb only remaining shield HP; leftover damage reaches HP.
- `applyCombatDamage()` may emit detailed replay events: `unit_blocked_damage`, `shield_damage`, `shield_break`, `damage`, and `lifesteal`.
- `combat.systems.ts` still emits legacy `attack` events for projectile, recoil, and old replay compatibility.
- `battle-replay-engine.ts` detects detailed damage logs. New logs mutate HP/text from detailed damage events; old attack-only logs keep legacy attack HP handling.

## Current Weapon / Utility Primitives
- Attack geometry: single target, AoE, line pierce, cone, beam, barrage, chain, and side weapons.
- Scaling: `rampDamage` increases primary damage while a unit keeps focusing the same target; `percentHpDamage` adds capped anti-giant bonus damage to primary hits before mitigation.
- Death/kill: temporary spawns expire deterministically, on-death puddles create hazards, and `onKill` can reset cooldown/heal/apply a status.
- Summons: `spawnCap` prevents infinite mobile factory/drone carrier/decoy loops.
- Defensive primitives: shield aura, regen aura, cleanse, status immunity, damage sharing, reactive armor charges, projectile interception.
- Battlefield objects: barriers/temporary spawns, mines, decoys, hazards, and deterministic pull displacement.
- Minimum range is handled by `combat.weapon-rules.ts` and `combat.positioning.ts`; artillery can back away instead of firing point blank.

## Current Known Gaps
- Stance/mode transforms are not implemented as a reusable primitive.
- Charge scaling is still a future anti-giant/carry tool.
- Hack control currently disables actions; conversion/redirect behavior is future work.
- Richer smoke/vision suppression and projectile accuracy are still future work.

## Tests & QA
- `src/__tests__/combat.engine.test.ts` — basic battle outcomes and timeout behavior.
- `src/__tests__/combat.spatial-hash.test.ts` — deterministic spatial query behavior.
- `src/__tests__/combat.targeting.test.ts` — sticky aggro, acquisition radius, fallback, long-range exceptions.
- `src/__tests__/combat.metrics.test.ts` — replay determinism and crowd movement metrics.
- `src/__tests__/combat.status.test.ts` — status stacking, ticking, cleanse, and action blocking.
- `src/__tests__/combat.damage.test.ts` — damage mitigation, shield overflow, and detailed damage replay actions.
- `src/__tests__/combat.weapon-shapes.test.ts` — cone and beam targeting/damage.
- `src/__tests__/combat.barrage.test.ts` — barrage impacts and minimum range behavior.
- `src/__tests__/combat.chain.test.ts` — deterministic chain jumps.
- `src/__tests__/combat.side-weapon.test.ts` — side weapon targeting/damage.
- `src/__tests__/combat.ramp.test.ts` — focused-fire ramp damage.
- `src/__tests__/combat.damage.test.ts` — includes capped percent-HP damage regression coverage.
- `src/__tests__/combat.on-kill.test.ts` — on-kill cooldown/heal behavior.
- `docs/simulator-qa.md` — Visual simulator QA matrix and metrics guide.

## Commands
- `npm test`
- `npx tsc --noEmit --pretty false`
- `npx tsx scripts/check-limits.ts --diff HEAD --json`

## Design Direction
- Do not add a hard `role` field to units.
- Use `targetingProfile` for targeting behavior, not broad strategic roles.
- Use `combatTags` for mechanical properties and targeting score modifiers, not rigid one-role-per-unit classes.
