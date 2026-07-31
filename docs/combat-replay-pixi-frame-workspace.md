# Pixi Replay Frame Workspace

## Goal

Remove short-lived JavaScript objects and arrays from the Pixi replay frame
path. Keep replay state, Crowd LOD output, seek behavior, and visual ordering
unchanged.

This slice is renderer-only. It does not change combat ECS ticks, replay logs,
movement, damage, targeting, winner resolution, or simulation version.

## Runtime Contract

- `ReplayFrameState` is one persistent object. `frame()` and `snapshot()`
  update its scalar fields and return the same reference.
- The replay roster owns one persistent `unitList` and ID index. Spawn adds to
  both; seek clears and rebuilds their contents without replacing either
  container.
- One `movedUnitIds` set is cleared and reused for every processed replay tick.
- Every action in a tick is still processed in order. The runtime regression
  suite explicitly covers multiple movement actions in the same tick.

## Render Workspace

`ReplayCrowdRenderWorkspace` replaces the allocating Pixi Crowd LOD planner:

- fixed field buckets are created lazily and then reused;
- frame-generation markers replace temporary maps and sets;
- unit and cluster views come from persistent pools;
- active buckets and component queues reuse their backing arrays;
- output unit order and canonical attacker/defender cluster order match the
  original pure planner.

The pure `buildReplayCrowdRenderPlan()` remains available for Canvas fallback
and parity tests.

The Pixi scene also owns persistent:

- unit and cluster display lists with frame stamps for visibility;
- floating-text output and occupied-bucket buffers;
- sprite-frame and texture caches;
- unit-label, parsed-color, and reusable style caches.

The hot path no longer builds `Object.values()`, a unit-view `Map`, a filtered
unit array, visibility `Set` objects, or sprite descriptor objects every frame.

## Performance

A local Node microbenchmark used 605 live units in two dense team regions,
two Crowd LOD clusters, and 500 interpolated frames. Two runs produced:

| Planner | Time per frame |
| --- | ---: |
| Allocating reference | 0.98-1.19 ms |
| Persistent workspace | 0.08-0.14 ms |

The isolated Crowd LOD phase was 8.3-12.3x faster. This is not an 8x claim for
the complete Pixi frame: GPU submission, `Graphics.clear()`/redraw, sprite
sorting, and browser compositing remain outside this benchmark.

After warm-up, workspace tests verify that repeated frames create no new unit,
bucket, or cluster view objects for an unchanged roster/layout.

## Verification

- Workspace output is compared with the pure planner across sparse, compact,
  clustered, dead-unit, interpolated, disconnected, and deterministic mixed
  layouts.
- Runtime tests verify stable frame/list/index references through frame,
  spawn, and seek operations.
- `tests/e2e/simulator2-replay-pixi.spec.ts` passes all five desktop/mobile
  checks, including debug vectors, seek/rewind stability, direct sprites, and
  dense `zerg_rush` Crowd LOD.

## Next Slice

Unit display objects now use retained geometry and hidden browser profiling.
See
[`combat-replay-retained-units.md`](./combat-replay-retained-units.md)
for the runtime contract, measurements, and remaining render bottlenecks.
