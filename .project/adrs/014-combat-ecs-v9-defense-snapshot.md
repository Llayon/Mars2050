---
id: 014
title: Combat ECS V9 Full Phase-Group Defense Snapshots
status: accepted
date: 2026-08-06
tags: [combat, ecs, damage, determinism, replay]
affects: [domains/combat/ecs, combat.action-intent.ts, combat.version.ts]
---

# Decision: Snapshot defenses at every resolution group

V8 remains available through `v8_sequential`; V9 uses `v9_snapshot`. A group is
the smallest simultaneous unit, so actor initiative tiers and post-action
impact/hazard groups receive independent snapshots. The scheduler order is:

```text
pre_action: periodic_ability, structural_flush, status
action: actor_turn (one group per initiative tier)
post_action: batch_movement, temporal_timeline, projectile_impact, hazard, hp_threshold
```

`EcsActionGroupLedger.begin()` captures an immutable frame of all live combat
entities and active barrier hazards. Pure claim collection and resolution use
external ids only; entity ids are restricted to capture/commit routing. Removing
a routed target or barrier before commit is a `CombatInvariantError`.

Claims sort by code-unit comparison of `originExternalId`, `authoredOrdinal`,
`targetExternalId`, and `sourceExternalId`. Duplicate keys are invariant
errors. The frame includes HP, shield, armor, statuses, marks, movement,
classes, charges, sharing recipients, transforms, and barrier coverage.

`full` preserves the V8 defensive pipeline. `bypass_all` is for status DoT and
hazard/mine damage: formulas remain V8-compatible while HP/death are
simultaneous in that group. Shared damage is frozen, one-level, and uses the V8
split/remainder rule; it never re-enters defenses. Shield-hit-block and reactive
armor charges are allocated in canonical claim order. Barrier reduction is read
from the frame for every covered claim, including claims after capacity break.

After resolution, damage, sharing, and lifesteal healing intents project HP;
status/mark effects require projected HP above zero, then deaths are resolved
simultaneously. A source alive at group start retains lifesteal eligibility even
if another claim projects its death.

All runtime mutations of shield, barrier capacity/duration, shield-hit-block
charges, and reactive-armor charges go through
`ecs/defense-resource-commit.ts`.

