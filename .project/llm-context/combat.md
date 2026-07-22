# Combat Domain — Mars2050

## Файлы домена
- `src/domains/combat/combat.engine.ts` — главный tick loop `simulateBattle`.
- `src/domains/combat/combat.config.ts` — unit configs and balance constants.
- `src/domains/combat/combat.types.ts` — DB/config-facing combat types and public re-exports.
- `src/domains/combat/combat.unit-*-components.ts` — canonical unit component schemas; `UnitSnapshot` is their flat boundary type.
- `src/domains/combat/combat.sim.types.ts` — snapshot/hazard/obstacle boundary aliases.
- `src/domains/combat/combat.actions.ts` — replay action/result types.
- `src/domains/combat/combat.version.ts` — current persisted simulation/replay version.
- `src/domains/combat/combat.phase.ts` — typed phase IDs, stages, and phase context.
- `src/domains/combat/ecs/combat-world.ts` — entity lifecycle, component stores, structural flush, snapshots.
- `src/domains/combat/ecs/combat-ecs-runtime.ts` — only production `CombatRuntime` implementation.
- `src/domains/combat/ecs/combat-phase-scheduler.ts` — canonical pre/post-action phase registry and order.
- `src/domains/combat/ecs/combat-components.ts` — typed stores and exhaustive snapshot-field mapping.
- `src/domains/combat/ecs/component-query-registry.ts` — revision-aware cached component queries.
- `src/domains/combat/ecs/entity-spatial-index.ts` — deterministic local EntityId queries.
- `src/domains/combat/ecs/external-id-allocator.ts` — battle-scoped monotonic serialized IDs.
- `src/domains/combat/ecs/unit-relation-codec.ts` — snapshot boundary for EntityId relations.
- `src/domains/combat/ecs/unit-capabilities.ts` — optional-mechanic marker components.
- `src/domains/combat/ecs/systems/` — targeting, movement, actions, damage, death, status, trigger, support, and hazard systems.
- `src/domains/combat/combat.deployment.ts` — attack/defense placement zones and validation.
- `src/domains/combat/combat.metrics.ts` — optional simulation metrics for simulator QA.
- `src/domains/combat/combat.upgrades.ts` — unit and global upgrade definitions.
- `src/domains/combat/combat.pathfinding.ts` — static obstacle flow field.
- `docs/combat-ecs.md` — authoritative runtime, phase, damage, timeout, and migration contract.

## UI / Renderer Layer
- `src/components/game/battle-replay-visuals.ts` — purely visual configuration (scale, anchor, hover, VFX scale, muzzle offsets). Kept strictly separated from `combat.config.ts` to preserve simulation determinism.
- `src/components/game/battle-replay-engine.ts` — public replay entry point; currently re-exports the canvas replay renderer.
- `src/components/game/battle-replay-canvas-*.ts` — active `/simulator2` replay renderer, event handling, draw helpers, and canvas state types.
- `src/components/game/battle-replay-labels.ts` — replay label/color contract for action readability.

## Core Rules
- Seeded replay must be deterministic. Do not introduce unseeded randomness in the simulation path.
- Seed `0` is valid; use nullish fallback for optional seeds, not truthy checks.
- Keep candidate ordering deterministic. Spatial hash query order is part of replay stability.
- Normal units should not use full-map aggro. Full-map acquisition must be explicit for special long-range units.
- Use `UnitBaseStats.targetingProfile = 'global'` for explicit full-map acquisition; do not add hidden hardcoded unit lists in targeting code.
- Movement uses flow/pathfinding plus steering. Do not remove flow or facing/turn logic without regression tests.
- Keep canonical runtime state in ECS component stores. `SimUnit` is allowed only at factory input and immutable output boundaries.
- Deep-copy mutable factory input at the world boundary. Callers must not be able to mutate an active battle.
- Runtime relations use `EntityId`; external string IDs are allowed only at factory and replay/snapshot boundaries.
- Structural or alive-state changes must invalidate registered query caches. Position and team changes must update the spatial index.
- Add optional mechanics through capability components so phase systems do not scan the complete unit roster.
- Add or reorder tick phases only through `EcsCombatPhaseScheduler` and update its explicit order contract.

## Current Targeting Model
- Heal targeting scans allies directly.
- Attack targeting uses canonical EntityId references plus snapshot-only external IDs.
- Local acquisition uses `EntitySpatialIndex` radius:
  - melee: fixed local radius.
  - ranged: `max(local radius, range + buffer)`.
  - special long-range units may acquire globally.
- If no local enemy is acquired, movement can use a global fallback target without setting aggro lock.

## Current Movement Model
- `EntitySpatialIndex` is built once and maintained incrementally for movement, team changes, deaths, summons, clones, and hazards.
- Dense nearest-target acquisition uses a deterministic candidate cap; broad mechanics still query local intersecting buckets.
- `ecs/systems/movement-system.ts` combines flow fields, facing, cohesion, steering, obstacle recovery, and minimum-range positioning.
- Burrow, stance, and ground/air mobility mutate movement and transform components and emit deterministic replay actions.
- `ecs/systems/depenetration-system.ts` performs the final overlap correction.
- Fully overlapped unit pairs use deterministic opposite separation directions; do not make zero-distance push one-sided.
- Mixed-size melee engagement reserves physical angular sectors rather than incompatible per-attacker slot indices.

## Current Status / Damage Model
- Runtime statuses live in `statusControl` components and tick through `ecs/systems/status-system.ts`.
- Current status types are `emp`, `slow`, `burn`, `acid`, `vulnerable`, `range_suppressed`, `revealed`, `hacked`, `damage_reduction`, `regen`, `output_suppressed`, `accuracy_reduced`, `armor_broken`, `degeneration`, `haste`, and `range_boost`.
- Same stack identity refreshes duration and keeps the strongest value. Avoid unbounded duplicate status stacks.
- `emp` and `hacked` block active actions. `slow` and `haste` affect movement. `range_boost` and `range_suppressed` affect acquisition, positioning, and action range. `burn`, `acid`, `degeneration`, and `regen` tick every 10 simulation ticks.
- Damage must go through the ECS damage systems; death must go through `resolveEcsDeath()`.
- `accuracy_reduced` turns smoke/suppression into deterministic glancing damage; `accuracyPenaltyResist` from optics upgrades reduces that penalty without adding random miss rolls.
- `burrowConfig` is explicit movement-state defense. It toggles `isBurrowed` while moving, is suppressed by `revealed`, and feeds the ECS movement-defense modifier.
- `armorPierceRatio` reduces the target's effective defense for one attack after `armor_broken` is applied. It does not add a persistent status.
- `summonCounterDamageMult` increases damage against `summoner` units, units with `summonOwnerId`, and temporary decoys. It does not affect normal units.
- `sensor_suite` grants a tag-limited enemy reveal aura. This reveal runs in the support aura pass before targeting, so hidden units can become valid targets without special-case acquisition.
- Shield overflow is intentional: shields absorb only remaining shield HP; leftover damage reaches HP. `shieldDamageMult` spends damage more efficiently against shield HP without multiplying damage against unshielded HP.
- The damage system may emit detailed replay events: `unit_blocked_damage`, `shield_damage`, `shield_break`, `damage`, and `lifesteal`.
- ECS action systems still emit `attack` intent events for projectile, recoil, and old replay compatibility.
- The canvas replay renderer exported through `battle-replay-engine.ts` applies detailed `damage`, `damage_share`, and `lifesteal` events for HP/text while still supporting old attack-only logs.

## Replay Version Contract
- `CURRENT_SIMULATION_VERSION` is `3`; new snapshots persist this version.
- `src/domains/pvp/pvp.replay-compat.ts` classifies stored snapshots before UI playback.
- Version 2 is playable as an approximate historical visualization and must show the persistent warning.
- Version 1, invalid versions, and future versions are unsupported and must not be silently re-simulated.
- Supported replay payloads pass `pvp.replay.schemas.ts` Zod validation before reaching the renderer.

## Current Weapon / Utility Primitives
- Attack geometry: single target, AoE, line pierce, cone, beam, barrage, chain, split fire, and side weapons.
- Scaling: `rampDamage` increases primary damage while a unit keeps focusing the same target; `percentHpDamage` adds capped anti-giant bonus damage to primary hits before mitigation.
- Control: `controlBeam` accumulates deterministic conversion progress, supports multi-target progress scaling, breaks on range/source or target death/cleanse, can swap team ownership, and can heal converted units to max HP.
- Death/kill: temporary spawns expire deterministically, on-death puddles create hazards, death triggers can explode or spawn units, reassembly schedules delayed revive, and `onKill` can reset cooldown/heal/apply a status.
- Movement scaling: `chargeDamage` converts actual movement distance into a capped primary-hit burst and then resets.
- Summons: `spawnCap` prevents infinite mobile factory/drone carrier/decoy loops; spawned and temporary units get the runtime `summoned` tag for targeting and anti-summoner counters.
- Defensive and support primitives: shield aura, tag-limited shield repair, regen aura, command haste aura, range relay aura, anti-stealth reveal aura, cleanse, status immunity, damage sharing, reactive armor charges, projectile interception, shield-breaker damage, armor-pierce damage, and anti-summoner damage.
- Battlefield objects: barriers/temporary spawns, mines, smoke fields, decoys, hazards, and deterministic pull/knockback displacement.
- Smoke fields are `smoke` hazards that apply `range_suppressed`, `output_suppressed`, and/or `accuracy_reduced` through the status kernel. Accuracy suppression is deterministic glancing damage, not random miss chance.
- Stance transforms: `stanceConfig` units deploy through ECS action/movement systems, can change effective range/cooldown/movement, and emit `stance_change` replay actions.
- Mobility mode transforms: `modeSwitchConfig` units switch runtime `mobilityMode` and `isFlying` through ECS movement state and emit `mode_change` replay actions.
- Burrow transforms: `burrowConfig` units enter underground movement while advancing, leave it before acting or when revealed, and emit `burrow_change` replay actions. `subterranean_blitz` uses this primitive.
- Support targeting: `healTargetTags` restricts heal actions and `SupportAura.targetTags` restricts aura targets by combat tags. Engineer uses both for mechanical repair and mechanical shield restoration.
- Minimum range is handled by `ecs/movement-positioning.ts`; artillery can back away instead of firing point blank.

## Current Known Gaps
- Stance/mode transforms have reusable siege/entrenched, movement-state burrow, and ground/air mobility mode primitives; richer mode-switch variants and richer underground counter variants remain future work.
- Hack control supports disable, redirect, confuse, and permanent conversion/ownership swap behavior. Remaining work is PvP content selection and tuning for thresholds, counters, and break conditions.
- Richer line-of-sight and concealment are still future work. Projectile accuracy now has a first deterministic penalty/resist primitive, but no line-of-sight occlusion yet.

## Tests & QA
- `src/__tests__/combat.ecs*.test.ts` — direct `CombatWorld` contracts for all runtime phases and mechanics.
- `src/__tests__/combat.engine.test.ts` — public battle outcomes and timeout behavior.
- `src/__tests__/combat.damage-order.test.ts` — contractual damage modifier order.
- `src/__tests__/combat.mirror-gate.test.ts` — team/coordinate symmetry gates.
- Scenario and ECS contracts assert seeded replay stability alongside behavior.
- `src/__tests__/combat.metrics.test.ts` — crowd movement and spatial-query metrics.
- `src/__tests__/combat.ecs-phase-scheduler.test.ts` — explicit phase order, stage equivalence, and seeded RNG guard.
- `src/__tests__/pvp.replay-compat.test.ts` — v2 fixture, current/future classification, and malformed payload rejection.
- `src/__tests__/battle-replay-compat-warning.test.tsx` — persistent legacy replay warning.
- `src/__tests__/battle-replay-labels.test.ts` — every `BATTLE_ACTION_TYPES` entry has a readable label/color or explicit exemption.
- `tests/e2e/simulator2-replay.spec.ts` — canvas replay smoke, mobile rendering, and debug overlays for hitboxes, velocity vectors, and target lines.
- `tests/e2e/simulator2-load.spec.ts` — simulator first screen defers replay chunks, Pixi chunks, and API calls until simulation starts.
- `docs/simulator-qa.md` — Visual simulator QA matrix and metrics guide.

## Commands
- `npm test`
- `npx tsc --noEmit --pretty false`
- `npx tsx scripts/check-limits.ts --diff HEAD --json`
- `npx tsx scripts/combat-ecs-benchmark.ts --runs=3 --compare=docs/combat-ecs-v2-performance.json`
- `npm run test:e2e:qa`

## Design Direction
- Do not add a hard `role` field to units.
- Use `targetingProfile` for targeting behavior, not broad strategic roles.
- Use `combatTags` for mechanical properties and targeting score modifiers, not rigid one-role-per-unit classes.
