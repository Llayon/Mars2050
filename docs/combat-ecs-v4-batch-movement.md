# Combat ECS v4 Batch Movement

## Goal

Replace per-actor movement queries and immediate position commits with a
deterministic two-phase movement pipeline. Preserve Tier 1 role outcomes,
formation choices, seeded determinism, mirror behavior, replay readability, and
immediate weapon displacement. Exact v3 HP totals and contact ticks are not a
compatibility requirement.

## Implemented Pipeline

1. `actor_turn` resolves initiative, targeting, attacks, healing, spawning, and
   forced displacement sequentially. Voluntary movement becomes a
   `MovementRequest`.
2. `batch_movement` captures an immutable SoA-style movement frame.
3. A canonical spatial-cell traversal builds bounded nearest-neighbor lists with
   at most 32 same-team neighbors per entity.
4. Steering and positioning produce intents without observing another intent's
   uncommitted position.
5. A deterministic Jacobi solver resolves same-layer overlaps once. Dirty
   entities use a local halo; dense dirty sets use the canonical full traversal.
6. Changed transforms are committed together and the spatial index updates only
   entities whose cell or position changed.
7. Replay move actions retain initiative order. Collision-only corrections use
   stable entity order and the existing `depenetration` motion marker.

## Supporting Optimizations

- Targeting reuses one computed candidate distance and skips a redundant result
  sort when deterministic score/tie-break comparison already defines the winner.
- Combat tags are cached per entity and invalidated by their runtime signature.
- Mixed-size melee occupancy uses a 24-bit sector mask and precomputed spans.
- Equal-speed groups alternate their starting team by tick so the shared
  movement frame does not turn first contact into a permanent attacker bias.
- Movement, neighbor, collision, and dirty-cell counters are available only in
  diagnostic profile mode.
- The old per-actor movement system remains a focused compatibility module but
  is not scheduled by the production tick pipeline.
- Movement broad phases use a fixed 16x31 packed grid with prefix offsets and
  stable insertion-order occupied cells. Top-32 neighbors live in flat typed
  heaps, while steering reads their finalized ID order through an indexed view.

## Compatibility

- `CURRENT_SIMULATION_VERSION` is 4.
- v2 and v3 stored replays remain playable as approximate historical
  visualizations; newer versions remain unsupported.
- v4 has six checked-in golden replay fingerprints, including `zerg_rush`.
- One collision pass is a balance constraint. Two unconditional passes delayed
  contact and failed the scout focus-fire role gate.

## Results

Same-machine medians with seed `24680`:

| Preset | Units | v3 ticks | v4 ticks | v3 production | v4 production |
| --- | ---: | ---: | ---: | ---: | ---: |
| `massive_clash` | 100 | 77 | 82 | 174.75 ms | 117.74 ms |
| `zerg_rush` | 605 | 138 | 205 | 3770.80 ms | 3009.14 ms |

For `zerg_rush`, total runtime improved 20.2% while per-tick runtime improved
46.3%. The longer battle is an intentional consequence of simultaneous
movement: later actors no longer gain movement information from earlier actors
inside the same tick. Neighbor plus collision candidates per tick are about 60%
lower than the old movement-query plus depenetration broad phases.

The three-second total target is now within normal wall-clock noise: the
production median is 3009.14 ms and the five-run diagnostic median is
2997.18 ms. The next completed optimization replaces general targeting
`queryCells` with a packed immutable frame; see
`docs/combat-ecs-v4-batch-targeting.md`.

## Verification

- Brute-force nearest-neighbor oracle with deterministic 32-entry cap.
- Packed occupied-cell order and full/dirty collision-pair brute-force oracles.
- v4 golden replay fingerprints.
- Tier 1 role scenario matrix.
- Mirror and marine crowd-stability gates.
- Full Vitest, TypeScript, architecture limits, production build, and Chromium
  simulator QA.
