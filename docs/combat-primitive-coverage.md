# Combat Primitive Coverage

This document is a coverage contract for Mechabellum-style mechanics in Mars2050.
It tracks reusable primitives only. It does not copy exact source-game numbers and
does not claim final balance.

The detailed technology-name contract is machine-readable in
`src/domains/combat/combat.primitive-coverage.ts` and enforced by
`combat.mechabellum-coverage-contract.test.ts`.

| Mechabellum effect family | Mars2050 primitive | Runtime status/state | Regression tests | Status |
| --- | --- | --- | --- | --- |
| EMP / upgrade shutdown | Status pipeline | `emp` | `combat.status.test.ts`, `combat.trigger-effects.test.ts` | Implemented |
| Slow / movement control | Status pipeline | `slow`, `haste` | `combat.status.test.ts` | Implemented |
| Burn / acid / degeneration | Status and hazard pipeline | `burn`, `acid`, `degeneration`, hazards | `combat.status.test.ts`, `combat.smoke.test.ts`, `combat.field-effects.test.ts` | Implemented |
| Vulnerability / armor break | Damage pipeline modifiers | `vulnerable`, `armor_broken` | `combat.status.test.ts`, `combat.damage.test.ts` | Implemented |
| Range, output, accuracy suppression | Smoke/hazard status payloads | `range_suppressed`, `output_suppressed`, `accuracy_reduced` | `combat.smoke.test.ts`, `combat.accuracy.test.ts`, `combat.field-effects.test.ts` | Implemented |
| Reveal / anti-stealth | Support aura and status | `revealed` | `combat.anti-stealth.test.ts`, `combat.auras.test.ts` | Implemented |
| Cleanse / extinguisher | Aura and field cleanse | `status_cleanse`, `hazard_cleanse` replay | `combat.auras.test.ts`, `combat.field-effects.test.ts` | Implemented |
| Status immunity | Aura/status blocker | `status_immunity` | `combat.auras.test.ts`, `combat.status.test.ts` | Implemented |
| Shield HP / shield repair | Shield state and shield replay events | `shield`, `maxShield` | `combat.damage.test.ts`, `combat.auras.test.ts` | Implemented |
| Shield guaranteed one-hit block | Shield overflow-hit block | `shieldHitBlock`, `shield_hit_block` replay | `combat.shield-hit-block.test.ts` | Implemented |
| Barrier dome mitigation | Area hazard mitigation | `barrier_dome` hazard, `barrier_absorb` replay | `combat.field-effects.test.ts` | Implemented |
| Finite barrier dome HP | Barrier capacity object | `capacity`, `barrier_spawn`, `barrier_break`, `barrier_expire` replay | `combat.field-effects.test.ts` | Implemented |
| Reactive armor / emergency armor | Damage block and trigger shield | `reactiveArmor*`, trigger `shield` payload | `combat.damage.test.ts`, `combat.trigger-effects.test.ts` | Implemented |
| Permanent flat block armor | Per-hit block primitive | `flatDamageBlock`, `unit_blocked_damage` replay | `combat.flat-block-armor.test.ts` | Implemented |
| Damage sharing | Damage pipeline split | `damageShare*` | `combat.damage.test.ts` | Implemented |
| Projectile interception | Attack-event mitigation | `projectileIntercept*` | `combat.projectile-defense.test.ts` | Implemented |
| Hack disable / redirect / confuse | Hack status targeting | `hacked` with `controlMode` | `combat.control.test.ts` | Implemented |
| Conversion control beam | Progress and team swap | `controlProgress`, `control_convert` replay | `combat.control-conversion.test.ts` | Implemented |
| Multi-control beam scaling | Progress multiplier per target | `controlBeam.maxTargets`, `multiTargetProgressMultiplier` | `combat.control-conversion.test.ts` | Implemented |
| Periodic missile, EMP, sticky, artillery abilities | Periodic ability scheduler | `periodicAbilities`, `periodic_ability` replay | `combat.periodic-abilities.test.ts` | Implemented |
| Minimum / maximum periodic ability range | Periodic target window | `periodicAbilities.minRange`, `periodicAbilities.maxRange` | `combat.periodic-abilities.test.ts` | Implemented |
| Periodic production waves | Periodic spawn payload | `periodicAbilities.payload.kind = spawn`, spawn caps | `combat.periodic-abilities.test.ts` | Implemented |
| Periodic maintenance / heal pulse | Periodic heal payload | `periodicAbilities.payload.kind = heal` | `combat.periodic-abilities.test.ts` | Implemented |
| Periodic air-defense / priority marks | Periodic mark payload | `periodicAbilities.payload.kind = mark`, `targetMark` | `combat.periodic-abilities.test.ts` | Implemented |
| HP-threshold effects | Trigger scheduler | `triggerEffects`, `trigger_effect` replay | `combat.trigger-effects.test.ts` | Implemented |
| Attack-count effects | Trigger scheduler | attack counters | `combat.trigger-effects.test.ts` | Implemented |
| Accumulator shield / attack-count barrier | Trigger field payload | `triggerEffects.payload.kind = field`, `barrier_spawn` replay | `combat.trigger-field-effects.test.ts` | Implemented |
| Damage-taken counter effects | Trigger scheduler | damage threshold hooks | `combat.trigger-effects.test.ts` | Implemented |
| Assault mode | Transform mode | `transformMode`, `transform_mode` replay | `combat.transform-variants.test.ts` | Implemented |
| Aerial / land mode | Transform mode and existing mode switch | `isFlying`, `canTargetAir`, `mobilityMode` | `combat.mode.test.ts`, `combat.transform-variants.test.ts` | Implemented |
| Entrenchment / siege mode | Stance and transform mode | `stanceMode`, `transformMode` | `combat.stance.test.ts`, `combat.transform-variants.test.ts` | Implemented |
| Jump drive / pre-battle reposition | Transform mode | `transformMode.mode = jump` | `combat.transform-variants.test.ts` | Implemented |
| Burrow / underground | Movement-state defense | `isBurrowed`, `burrow_change` replay | `combat.burrow.test.ts` | Implemented |
| Burrow maintenance / emerge strike | Underground regen and one-shot attack modifier | `burrow_regen`, `emerge_strike` replay | `combat.burrow.test.ts` | Implemented |
| Charge / kinetic scaling | Movement-distance damage | `chargeDistance` | `combat.charge.test.ts` | Implemented |
| Chamber compression / attack charge | Attack-charge accumulator | `attackCharge`, `attack_charge_release` replay | `combat.stat-growth-charge.test.ts` | Implemented |
| Combat evolvement / rank scaling | Runtime rank metadata and scaling | `rank`, `rankScaling` | `combat.rank-scaling.test.ts` | Implemented |
| Conditional range by target type/rank | Target-aware action range | `conditionalRange`, `getEffectiveActionRangeAgainst` | `combat.conditional-range.test.ts` | Implemented |
| Ramp / beam scaling | Focused-fire damage | `rampTargetId`, `rampMultiplier` | `combat.ramp.test.ts` | Implemented |
| Percent current / max HP damage | Damage pipeline and effect payload bonus | `percentHpDamage.basis`, `payload.percentHp` | `combat.damage.test.ts`, `combat.periodic-abilities.test.ts`, `combat.trigger-effects.test.ts` | Implemented |
| Beam, cone, line, barrage, chain, split, side weapons | Attack geometry primitives | weapon config state | `combat.weapon-shapes.test.ts`, `combat.barrage.test.ts`, `combat.chain.test.ts`, `combat.split-fire.test.ts`, `combat.side-weapon.test.ts` | Implemented |
| Upgrade-driven weapon shape changes | Upgrade modifiers merged into runtime weapon configs | `linePierce`, `coneAttack`, `beamAttack`, `barrageAttack`, `chainAttack`, `splitFire`, `sideWeapon` modifiers | `combat.weapon-shape-upgrades.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |
| On-death puddle | Death hazard spawn | `onDeathPuddle`, `hazard_spawn` replay | `combat.death-kill-effects.test.ts` | Implemented |
| On-death explosion | Death trigger damage | `triggerEffects.event = death` | `combat.death-kill-effects.test.ts` | Implemented |
| On-death spawn / mechanical division | Death trigger spawn | `triggerEffects` spawn payload | `combat.death-kill-effects.test.ts` | Implemented |
| Delayed reassembly / quantum revive | Delayed revive scheduler | `reassembly`, `delayed_reassembly`, `reassembly_complete` replay | `combat.reassembly.test.ts` | Implemented |
| On-kill recycling / heal | Kill trigger heal and existing `onKill` | `onKill`, `triggerEffects.event = kill` | `combat.on-kill.test.ts`, `combat.death-kill-effects.test.ts` | Implemented |
| Replicate / clone with cap | Existing kill clone and trigger spawn cap | `replicateOnKill`, trigger spawn `cap` | `combat.spawn-cap.test.ts`, `combat.death-kill-effects.test.ts` | Implemented |
| Smoke / sandstorm field variants | Hazard field status payloads | `smoke` hazard with status effects | `combat.smoke.test.ts`, `combat.field-effects.test.ts` | Implemented |
| Loose formation | Formation spacing modifier | `formationModifiers.spacingMultiplier` | `combat.formation-targeting-primitives.test.ts` | Implemented |
| Grid / neighbor bonus | Adjacency status bonus | `formationModifiers.adjacencyBonus` including attack/range/defense | `combat.formation-targeting-primitives.test.ts` | Implemented |
| Air defense / fortified / anti-heavy priority mark | Target score mark priority | `targetMark.focusPriority`, `targetPriorityProfile` | `combat.formation-targeting-primitives.test.ts` | Implemented |
| Whirlwind / conditional AoE | Conditional attack mode | `conditionalAttackMode`, `conditional_attack_mode` replay | `combat.conditional-sweep-weapons.test.ts` | Implemented |
| Vertical sweep | Sweep secondary hits | `sweepAttack`, `sweep_hit` replay | `combat.conditional-sweep-weapons.test.ts` | Implemented |
| Stealth while moving | Movement-derived targetability | `stealthWhileMoving`, `movementStealthActive`, `stealth_change` replay | `combat.stealth-while-moving.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |
| Stored upgrade on-death spawn modifier | Upgrade adapter to death trigger spawn | `onDeathSpawn` -> `triggerEffects.event = death` | `combat.death-kill-effects.test.ts`, `combat.upgrade-runtime-contract.test.ts` | Implemented |

`primitive-covered` in the machine-readable coverage means Mars2050 has the
reusable runtime primitive and regression coverage, but does not claim exact
source-game balance numbers or final content tuning.

Deferred means the key remains legal in `UpgradeConfig.modifiers` only because
it is explicitly listed in `DEFERRED_UPGRADE_MODIFIERS`. The deferred list is
currently empty; new on-death spawn content should prefer explicit
`triggerEffects`, while legacy `onDeathSpawn` is adapted into that primitive.
