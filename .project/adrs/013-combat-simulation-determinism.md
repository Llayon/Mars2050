---
id: 013
title: Combat Simulation Determinism
status: accepted
date: 2026-06-24
tags: [combat, simulation, determinism, replay]
affects: [combat.md, combat.engine.ts, combat.targeting.ts, combat.movement.ts, spatial-hash.ts]
---

# Decision: Deterministic Tick-Based Combat Simulation

## Context
Combat now includes tick simulation, squads, movement, obstacles, AoE, statuses, upgrades, hazards, spatial hash, local aggro, steering, PvE, and replay logs. This makes small nondeterministic changes risky: they can break replay stability, balance, and test reproducibility.

## Decision
Combat simulation must remain deterministic when `simulateBattle` receives a seed.

The engine uses:
- seeded `PRNG` for combat randomness;
- deterministic unit turn order;
- deterministic spatial hash query ordering;
- sticky target ids instead of mutable target references;
- local acquisition for normal aggro;
- explicit full-map acquisition only for special long-range units;
- regression tests for replay equality and crowd movement metrics.

## Rules
- Do not use `Math.random()` or `Date.now()` inside seeded simulation flow.
- Do not rely on `Map` traversal unless insertion order is intentionally controlled.
- Sort or preserve candidate order explicitly when it can affect targeting.
- Do not switch normal units back to full-map target scoring by default.
- Do not replace flow/pathfinding movement with steering-only movement without tests.
- Keep replay actions compact and deterministic.

## Good Example
```typescript
const resultA = simulateBattle(attackers, defenders, 12345, [])
const resultB = simulateBattle(attackers, defenders, 12345, [])
expect(resultB.logs).toEqual(resultA.logs)
```

## Bad Example
```typescript
const jitter = Math.random() * 10
unit.x += jitter
```

## Consequences
### Positive
- Replays can be validated and compared.
- Combat regressions can be caught with focused tests.
- Balance changes are easier to reason about.

### Negative
- Some convenient random or unordered APIs are off-limits.
- Spatial structures need explicit ordering and update strategy.

## Related
- ADR-001: Domain-Based Architecture
- `.project/llm-context/combat.md`
