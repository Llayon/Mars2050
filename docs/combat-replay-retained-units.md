# Pixi Retained Unit Rendering

## Goal

Remove per-frame reconstruction of unit graphics from the Pixi replay path.
Keep simulation data, replay timing, Crowd LOD, seek behavior, interpolated
positions, and exact `zIndex = interpolatedY` ordering unchanged.

This slice does not change combat ECS ticks, replay actions, movement,
targeting, damage, winner resolution, or the Canvas fallback.

## Hidden Profiler

Append `?replayProfile=1` to the simulator URL before opening a Pixi replay.
Without this flag no timing buffers or profile event listeners are created.

The profiler excludes 30 warm-up frames and keeps 600 samples in typed ring
buffers. It records:

- replay runtime, Crowd planning, unit sync, effects, Pixi render submission,
  and total ticker CPU time;
- frame intervals and estimated delayed frames;
- position, depth, sprite, HP, fallback, flash, hitbox, velocity, and status
  update counters.

To export a snapshot without exposing debug UI:

```js
const canvas = document.querySelector('[data-replay-renderer="pixi"]')
canvas.dispatchEvent(new CustomEvent('mars2050:replay-profile-request'))
JSON.parse(canvas.dataset.replayProfileJson)
```

The canvas emits `mars2050:replay-profile-ready` after serializing the
versioned JSON. `ReplayAppHandle.getPerformanceProfile()` exposes the same
snapshot to internal callers. Canvas fallback returns `null`.

`renderSubmitMs` covers CPU work through Pixi's render ticker callback. It
does not measure GPU completion or browser compositing.

## Retained Unit Contract

Each unit owns one persistent container and render-state cache:

- movement updates the container position instead of every child coordinate;
- depth remains the exact interpolated Y value;
- sprite direction and texture are resolved only when movement endpoints,
  team, or type change;
- fallback, flash, hitbox, and velocity geometry rebuild only when their
  signatures change;
- HP background and fill use persistent white sprites; HP changes update tint,
  position, or width;
- labels and status visibility update independently;
- hidden Crowd LOD units retain their display objects for reuse.

Hazards, projectiles, clusters, and floating text remain transient render
systems because their counts and lifetimes are small.

## Measurements

The detailed capture is stored in
[`combat-replay-retained-performance.json`](./combat-replay-retained-performance.json).
The main same-policy `zerg_rush` comparison was:

| Metric | Before | Retained | Change |
| --- | ---: | ---: | ---: |
| Unit sync p50 | 3.8 ms | 1.1 ms | -71% |
| Unit sync p95 | 5.4 ms | 2.4 ms | -56% |
| Total CPU p50 | 14.6 ms | 7.7 ms | -47% |
| Total CPU p95 | 17.4 ms | 15.7 ms | -10% |
| Primitive updates / visible unit | 5.0 | 0.014 | -99.7% |

With coarse-pointer mobile policy, 605 roster units select the 30 FPS,
stride-3 budget and update about 220 individual unit displays per frame.
Measured unit sync was 0.8 ms p50 and 2.0 ms p95.

These are comparative headless development-server measurements. High
percentiles for the complete frame include Pixi submission, Next.js
development work, and host scheduling. They are not claims about a specific
phone's frame rate.

## Verification

- Unit tests cover stable geometry, container-only movement, isolated HP
  updates, and retained debug overlays.
- Profiler tests cover warm-up exclusion, bounded samples, JSON versioning,
  and explicit query activation.
- Pixi E2E covers desktop/mobile rendering, overlays, seek/rewind, dense LOD,
  direct sprite assets, hidden profile export, and zero rebuilds while paused.
- Production smoke verifies that the profile request has no effect without
  the query flag.

## Next Decision

The remaining dense-fight cost is primarily Pixi render submission and exact
Y sorting, not unit geometry construction. Depth quantization or tick-level
sorting would change visual ordering and remains intentionally out of scope.
