# Combat Primitive Coverage

This document is a coverage contract for Mechabellum-style mechanics in Mars2050.
It tracks reusable primitives only. It does not copy exact source-game numbers and
does not claim final balance.

The detailed technology-name contract is machine-readable in
`src/domains/combat/combat.primitive-coverage.ts` and enforced by
`combat.mechabellum-coverage-contract.test.ts`.

## Replay QA Contract

Primitive coverage includes visible replay semantics, not only simulation state.
`/simulator2` exports replay rendering through
`src/components/game/battle-replay-engine.ts`. Pixi is the default renderer for
`/simulator2`; Canvas remains selectable for diagnostics and is the fallback if
Pixi initialization fails.

Replay action labels are centralized in
`src/components/game/battle-replay-labels.ts`. Every action in
`BATTLE_ACTION_TYPES` must either have a readable label/color or be explicitly
listed in `REPLAY_ACTION_LABEL_EXEMPTIONS`; `battle-replay-labels.test.ts`
enforces that contract.

Visual replay smoke coverage lives in `tests/e2e/simulator2-replay.spec.ts`.
It covers preset replay startup, mobile rendering, debug overlays for hitboxes,
velocity vectors and target lines, and guards that the default `/simulator2`
replay path loads Pixi only after replay opens. Pixi parity/stress coverage
lives in `tests/e2e/simulator2-replay-pixi.spec.ts`; it covers lazy Pixi
loading, mobile fit, overlay parity, seek/rewind stability, dense movement
readability, and zerg Crowd LOD. Canvas remains covered by the screenshot
baseline suite as the fallback renderer.

| Mechabellum effect family | Mars2050 primitive | Runtime status/state | Regression tests | Status |
| --- | --- | --- | --- | --- |
| EMP / upgrade shutdown | Status pipeline | `emp` | `combat.ecs-status-death.test.ts`, `combat.ecs-post-hit-triggers.test.ts` | Implemented |
| Slow / movement control | Status pipeline | `slow`, `haste` | `combat.ecs-periodic-ability-phase.test.ts`, `combat.ecs-support-aura-phase.test.ts` | Implemented |
| Burn / acid / degeneration | Status and hazard pipeline | `burn`, `acid`, `degeneration`, hazards | `combat.ecs-status-death.test.ts`, `combat.ecs-smoke-action.test.ts` | Implemented |
| Vulnerability / armor break | Damage pipeline modifiers | `vulnerable`, `armor_broken` | `combat.damage-order.test.ts`, `combat.armor-pierce.test.ts` | Implemented |
| Range, output, accuracy suppression | Smoke/hazard status payloads | `range_suppressed`, `output_suppressed`, `accuracy_reduced` | `combat.ecs-smoke-action.test.ts`, `combat.accuracy.test.ts` | Implemented |
| Reveal / anti-stealth | Support aura and status | `revealed` | `combat.ecs-support-aura-phase.test.ts`, `combat.anti-stealth-upgrade.test.ts` | Implemented |
| Cleanse / extinguisher | Aura and field cleanse | `status_cleanse`, `hazard_cleanse` replay | `combat.ecs-support-aura-phase.test.ts`, `combat.ecs-field-effect-phase.test.ts` | Implemented |
| Status immunity | Aura/status blocker | `status_immunity` | `combat.ecs-support-aura-phase.test.ts` | Implemented |
| Shield HP / shield repair | Shield state and shield replay events | `shield`, `maxShield` | `combat.ecs.test.ts`, `combat.ecs-support-aura-phase.test.ts` | Implemented |
| Shield guaranteed one-hit block | Shield overflow-hit block | `shieldHitBlock`, `shield_hit_block` replay | `combat.shield-hit-block.test.ts` | Implemented |
| Barrier dome mitigation | Area hazard mitigation | `barrier_dome` hazard, `barrier_absorb` replay | `combat.ecs-damage-primitives.test.ts` | Implemented |
| Finite barrier dome HP | Barrier capacity object | `capacity`, `barrier_spawn`, `barrier_break`, `barrier_expire` replay | `combat.ecs-field-effect-phase.test.ts`, `combat.ecs-post-hit-triggers.test.ts` | Implemented |
| Reactive armor / emergency armor | Damage block and trigger shield | `reactiveArmor*`, trigger `shield` payload | `combat.ecs.test.ts`, `combat.ecs-hp-threshold-triggers.test.ts` | Implemented |
| Permanent flat block armor | Per-hit block primitive | `flatDamageBlock`, `unit_blocked_damage` replay | `combat.flat-block-armor.test.ts` | Implemented |
| Damage sharing | Damage pipeline split | `damageShare*` | `combat.ecs-damage-primitives.test.ts` | Implemented |
| Projectile interception | Attack-event mitigation | `projectileIntercept*` | `combat.ecs-damage-primitives.test.ts` | Implemented |
| Hack disable / redirect / confuse | Hack status targeting | `hacked` with `controlMode` | `combat.ecs-action-boundary.test.ts`, `combat.ecs-on-hit.test.ts` | Implemented |
| Conversion control beam | Progress and team swap | `controlProgress`, `control_convert` replay | `combat.ecs-control-beam-phase.test.ts` | Implemented |
| Multi-control beam scaling | Progress multiplier per target | `controlBeam.maxTargets`, `multiTargetProgressMultiplier` | `combat.ecs-control-beam-phase.test.ts` | Implemented |
| Periodic missile, EMP, sticky, artillery abilities | Periodic ability scheduler | `periodicAbilities`, `periodic_ability` replay | `combat.ecs-periodic-ability-phase.test.ts` | Implemented |
| Minimum / maximum periodic ability range | Periodic target window | `periodicAbilities.minRange`, `periodicAbilities.maxRange` | `combat.ecs-periodic-ability-phase.test.ts` | Implemented |
| Periodic production waves | Periodic spawn payload | `periodicAbilities.payload.kind = spawn`, spawn caps | `combat.ecs-periodic-spawner.test.ts` | Implemented |
| Periodic maintenance / heal pulse | Periodic heal payload | `periodicAbilities.payload.kind = heal` | `combat.ecs-periodic-ability-phase.test.ts` | Implemented |
| Periodic air-defense / priority marks | Periodic mark payload | `periodicAbilities.payload.kind = mark`, `targetMark` | `combat.ecs-periodic-ability-phase.test.ts` | Implemented |
| HP-threshold effects | Trigger scheduler | `triggerEffects`, `trigger_effect` replay | `combat.ecs-hp-threshold-triggers.test.ts` | Implemented |
| Attack-count effects | Trigger scheduler | attack counters | `combat.ecs-post-hit-triggers.test.ts` | Implemented |
| Accumulator shield / attack-count barrier | Trigger field payload | `triggerEffects.payload.kind = field`, `barrier_spawn` replay | `combat.ecs-trigger-field.test.ts` | Implemented |
| Damage-taken counter effects | Trigger scheduler | damage threshold hooks | `combat.ecs-post-hit-triggers.test.ts` | Implemented |
| Assault mode | Transform mode | `transformMode`, `transform_mode` replay | `combat.ecs-transform-mode-phase.test.ts` | Implemented |
| Aerial / land mode | Transform mode and existing mode switch | `isFlying`, `canTargetAir`, `mobilityMode` | `combat.ecs-transform-mode-phase.test.ts`, `combat.mode-engine.test.ts` | Implemented |
| Entrenchment / siege mode | Stance and transform mode | `stanceMode`, `transformMode` | `combat.ecs-artillery-action.test.ts`, `combat.stance-engine.test.ts` | Implemented |
| Jump drive / pre-battle reposition | Transform mode | `transformMode.mode = jump` | `combat.ecs-transform-mode-phase.test.ts` | Implemented |
| Burrow / underground | Movement-state defense | `isBurrowed`, `burrow_change` replay | `combat.burrow-ecs-contract.test.ts` | Implemented |
| Burrow maintenance / emerge strike | Underground regen and one-shot attack modifier | `burrow_regen`, `emerge_strike` replay | `combat.ecs-burrow-regeneration.test.ts`, `combat.ecs-emerge-action.test.ts` | Implemented |
| Charge / kinetic scaling | Movement-distance damage | `chargeDistance` | `combat.ecs-primary-damage-modifiers.test.ts` | Implemented |
| Chamber compression / attack charge | Attack-charge accumulator | `attackCharge`, `attack_charge_release` replay | `combat.ecs-growth-charge-phase.test.ts` | Implemented |
| Combat evolvement / rank scaling | Runtime rank metadata and scaling | `rank`, `rankScaling` | `combat.rank-scaling.test.ts` | Implemented |
| Conditional range by target type/rank | Target-aware action range | `conditionalRange`, `getEcsEffectiveActionRangeAgainst` | `combat.ecs-conditional-range.test.ts` | Implemented |
| Ramp / beam scaling | Focused-fire damage | EntityId ramp target and multiplier | `combat.ecs-primary-damage-modifiers.test.ts` | Implemented |
| Percent current / max HP damage | Damage pipeline and effect payload bonus | `percentHpDamage.basis`, `payload.percentHp` | `combat.ecs-primary-damage-modifiers.test.ts`, `combat.ecs-periodic-ability-phase.test.ts` | Implemented |
| Beam, cone, line, barrage, chain, split, side weapons | Attack geometry primitives | weapon config state | `combat.ecs-directional-geometry.test.ts`, `combat.ecs-barrage-attack.test.ts`, `combat.ecs-chain-attack.test.ts`, `combat.ecs-split-fire.test.ts`, `combat.ecs-side-weapon.test.ts` | Implemented |
| Upgrade-driven weapon shape changes | Upgrade modifiers merged into runtime weapon configs | `linePierce`, `coneAttack`, `beamAttack`, `barrageAttack`, `chainAttack`, `splitFire`, `sideWeapon` modifiers | `combat.weapon-shape-upgrades.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |
| On-death puddle | Death hazard spawn | `onDeathPuddle`, `hazard_spawn` replay | `combat.ecs-on-death-puddle.test.ts` | Implemented |
| On-death explosion | Death trigger damage | `triggerEffects.event = death` | `combat.ecs-death-trigger-action.test.ts` | Implemented |
| On-death spawn / mechanical division | Death trigger spawn | `triggerEffects` spawn payload | `combat.ecs-death-trigger-action.test.ts` | Implemented |
| Delayed reassembly / quantum revive | Delayed revive scheduler | `reassembly`, `delayed_reassembly`, `reassembly_complete` replay | `combat.ecs-reassembly-phase.test.ts` | Implemented |
| On-kill recycling / heal | Kill trigger heal and existing `onKill` | `onKill`, `triggerEffects.event = kill` | `combat.ecs-on-kill-action.test.ts` | Implemented |
| Replicate / clone with cap | Existing kill clone and trigger spawn cap | `replicateOnKill`, trigger spawn `cap` | `combat.ecs-replicate-on-kill.test.ts` | Implemented |
| Smoke / sandstorm field variants | Hazard field status payloads | `smoke` hazard with status effects | `combat.ecs-smoke-action.test.ts`, `combat.ecs-field-effect-phase.test.ts` | Implemented |
| Loose formation | Formation spacing modifier | `formationModifiers.spacingMultiplier` | `combat.formation-spacing.test.ts` | Implemented |
| Grid / neighbor bonus | Adjacency status bonus | `formationModifiers.adjacencyBonus` including attack/range/defense | `combat.ecs-formation-bonus-phase.test.ts` | Implemented |
| Air defense / fortified / anti-heavy priority mark | Target score mark priority | `targetMark.focusPriority`, `targetPriorityProfile` | `combat.ecs-targeting-boundary.test.ts` | Implemented |
| Whirlwind / conditional AoE | Conditional attack mode | `conditionalAttackMode`, `conditional_attack_mode` replay | `combat.ecs-conditional-attack.test.ts` | Implemented |
| Vertical sweep | Sweep secondary hits | `sweepAttack`, `sweep_hit` replay | `combat.ecs-sweep-attack.test.ts` | Implemented |
| Stealth while moving | Movement-derived targetability | `stealthWhileMoving`, `movementStealthActive`, `stealth_change` replay | `combat.ecs-stealth-action.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |
| Stored upgrade on-death spawn modifier | Upgrade adapter to death trigger spawn | `onDeathSpawn` -> `triggerEffects.event = death` | `combat.ecs-death-trigger-action.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |

`primitive-covered` in the machine-readable coverage means Mars2050 has the
reusable runtime primitive and regression coverage, but does not claim exact
source-game balance numbers or final content tuning.

Deferred means the key remains legal in `UpgradeConfig.modifiers` only because
it is explicitly listed in `DEFERRED_UPGRADE_MODIFIERS`. The deferred list is
currently empty; new on-death spawn content should prefer explicit
`triggerEffects`, while legacy `onDeathSpawn` is adapted into that primitive.
