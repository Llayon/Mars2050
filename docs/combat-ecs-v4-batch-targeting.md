# Combat ECS v4 Batch Targeting

## Goal

Replace per-acquisition `EntitySpatialIndex.queryCells()` calls and temporary
candidate arrays with one deterministic targeting frame per actor phase.
Preserve the complete v4 replay contract, including sequential death, spawn,
team-change, resurrection, and forced-displacement visibility.

## Runtime Contract

1. `actor_turn` builds one immutable targeting frame from the stable
   `CombatWorld.query()` entity order.
2. Live attacker and defender IDs are packed into fixed-grid typed arrays with
   prefix offsets.
3. Local acquisition scans only intersecting cells and writes entity IDs plus
   their already-computed distances into one reusable scratch buffer.
4. Selection compacts candidates in place. It does not allocate temporary
   `filter`, `map`, or `reduce` results.
5. Death, resurrection, spawn, team change, and immediate displacement mark an
   entity dirty. A local live-delta scan excludes its stale frame entry and
   evaluates current component state.
6. The frame closes after all sequential actor actions. Two-phase movement then
   builds and commits its separate immutable movement frame.

The frame must use stable ECS entity order, not initiative order. Initiative
order changes every tick and leaked candidate-order differences into melee and
movement state even when visible attack actions matched. The stable query order
keeps the original 205-tick `zerg_rush` replay fingerprint.

Calls to `runTargetingSystem()` outside an active actor frame retain the
canonical spatial fallback. That path keeps defensive dead/team validation and
is covered by focused system tests. Production actor turns have zero targeting
fallbacks.

## Allocation And CPU Changes

- Team cells, offsets, cursors, dirty flags, and candidate data use persistent
  typed arrays.
- Candidate distance is computed during the radius check and reused by nearest
  and aggro scoring.
- Reachable candidates are compacted in place while preserving their distance.
- A team-specific packed query guarantees current live-team membership, so the
  hot path does not reread vitality and identity for every candidate.
- Normal visible units take an O(1) visibility path without allocating an
  `Array.some()` callback.
- Target score source state is read once per selection, not once per candidate.
- Diagnostic counters and timers remain disabled in production mode.

## Determinism

The simulation version remains 4 because output did not change. The v4 golden
suite now contains six replay fingerprints, including the 605-unit
`zerg_rush` contract:

`a674e659111b627330cb7486eec9817cd4b8110a5863d4f4f3f7ea7bb3aed629`

Focused live-delta tests cover:

- forced displacement after frame construction;
- spawn after frame construction;
- team conversion after frame construction;
- resurrection after frame construction.

## Performance

Same-process A/B runs alternated the temporary legacy and packed backends to
reduce warm-up and background-load bias. Both used seed `24680` and produced
the same tick count and replay fingerprint.

| Preset | Units | Ticks | Legacy median | Packed median | Change |
| --- | ---: | ---: | ---: | ---: | ---: |
| `massive_clash` | 100 | 82 | 182.15 ms | 158.38 ms | -13.0% |
| `zerg_rush` | 605 | 205 | 3758.89 ms | 3371.06 ms | -10.3% |

The temporary backend selector was removed after A/B validation. Production
always uses the packed frame.

Diagnostic profile results:

| Preset | Frames | Acquisitions | Packed candidates | Max/query | Frame build | Query | Selection |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `massive_clash` | 82 | 2,617 | 15,714 | 50 | 1.00 ms | 6.83 ms | 24.84 ms |
| `zerg_rush` | 205 | 33,514 | 897,166 | 353 | 8.42 ms | 148.71 ms | 936.88 ms |

The general spatial profile previously reported 2,617 and 33,514 targeting
queries for these scenarios. It now reports zero. The 595 remaining
`zerg_rush` spatial queries are classified as `other` and belong to mechanics
outside this slice.

Raw benchmark data is stored in
`docs/combat-ecs-v4-targeting-performance.json`.

## Next Slice

Remove per-frame Pixi replay allocations by keeping persistent unit lists,
entity lookup maps, and reusable render/text work buffers. This does not change
simulation output; its primary gate is mobile frame-time and GC stability.
