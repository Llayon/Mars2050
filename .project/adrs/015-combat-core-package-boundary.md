---
id: 015
title: Combat Core Package Boundary and Deterministic Facade
status: accepted
date: 2026-09-10
tags: [combat, package, boundary, architecture, determinism, replay]
affects: [packages/combat-core, src/domains/combat, scripts/check-limits.ts]
---

# Decision: Isolated Shared Combat Core Package

## Context
Mars2050 simulation engine was embedded in `src/domains/combat`. A second independent consumer (Fantasy) requires the same simulation capabilities without inheriting Mars2050 web application dependencies (Next.js, React, Supabase, DB models, Mars unit definitions). At the same time, Mars2050 must preserve exact deterministic replay outcomes, legacy wire formatting, and V8/V9 defense snapshots without maintaining two separate runtime implementations.

## Decision
1. **Single Runtime Implementation**: Extract combat runtime, compiler, ECS, scheduler, spatial indexing, movement, and replay codecs into `packages/combat-core`. Mars2050 and Fantasy both consume this package. No duplicate simulation engines exist.
2. **Strict Package Boundary**:
   - Zero runtime dependencies except Zod for input validation schemas.
   - Zero imports from `@/`, Next.js, React, Supabase, or database schema types.
   - Zero hardcoded game catalogs: `UNIT_TYPES`, `UPGRADES`, and species-specific heuristics (e.g. `alien_*`) are replaced by explicit data contracts and parameters passed in the battle context.
3. **Immutability & Determinism**:
   - Simulation is 100% deterministic for identical inputs and seeds.
   - Input structures are treated as read-only and never mutated by the engine.
   - Arena dimensions, spatial queries, and entity states belong strictly to a single battle instance.
4. **Wire Compatibility & Versioning**:
   - Public replay and snapshot serialization maintain byte/field order compatibility for legacy Mars replays.
   - Engine build version, ruleset schema version, and replay schema version are separated.
5. **Architectural Enforcement**:
   - `scripts/check-limits.ts` scans `packages/combat-core` with file limit rules.
   - `COMBAT_DEFENSE_MUTATION` rule extends to `packages/combat-core` to prevent uncommitted defense mutations.

## Consequences
- **Positive**:
  - Fantasy consumer runs purely on Node / browser without Mars dependencies.
  - Mars PvP, PvE, and replays continue to match baseline goldens.
  - Single maintenance surface for combat simulation.
- **Negative**:
  - Packaging requires build step (`npm run combat:core:build`) and clean workspace configuration.
