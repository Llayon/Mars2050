# Pixi Retained Unit Rendering

## Goal

Remove per-frame reconstruction and permanent optional primitives from the
Pixi replay path. Keep simulation data, Crowd LOD, seek behavior,
interpolated positions, and exact `zIndex = interpolatedY` ordering
unchanged.

This slice does not change combat ECS ticks, movement, targeting, damage, or
winner resolution. Replay actions now also reconstruct a deterministic visual
timeline shared by Pixi and the Canvas fallback.

## Hidden Profiler

Append `?replayProfile=1` to the simulator URL before opening a Pixi replay.
Without this flag no timing buffers or profile event listeners are created.

The profiler excludes 30 warm-up frames and keeps 600 samples in typed ring
buffers. It records:

- replay runtime, Crowd planning, unit sync, effects, Pixi render submission,
  and total ticker CPU time;
- frame intervals and estimated delayed frames;
- position, depth, sprite, HP, fallback, flash, hitbox, velocity, and status
  update counters;
- animation frame changes and the latest sparse scene profile: visible unit
  containers, active child count, active optional objects, and pool capacity.

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

Each unit owns one persistent container and render-state cache. A regular
sprite-backed unit has exactly three permanent renderables:

- one primary sprite whose texture represents direction and animation frame;
- one HP background sprite;
- one HP fill sprite.

The retained behavior is:

- movement updates the container position instead of every child coordinate;
- depth remains the exact interpolated Y value;
- fallback, flash, status text, hitbox, and velocity objects are acquired
  lazily from a scene-owned pool and detached when inactive;
- HP background and fill use persistent white sprites; HP changes update tint,
  position, or width;
- hidden Crowd LOD units retain their display objects for reuse.

Hazards, projectiles, clusters, and floating text remain transient render
systems because their counts and lifetimes are small.

## Deterministic Animation Contract

`ReplayFrameState.replayTimeMs` is the only animation clock. Unit visual state
tracks facing, movement continuity, attack start, and death start. The
renderer resolves clips in this order:

1. `death`
2. `attack`
3. `walk`
4. `idle`

Pixi does not use an autonomous `AnimatedSprite` ticker. Pausing freezes the
resolved frame, while seek and rewind rebuild it from replay actions. A
stationary attacker faces the target recorded by the attack action.

Visual registry entries may declare a single horizontal atlas with optional
`idle`, `walk`, `attack`, and `death` clip ranges. Each range declares start
frame, frames per direction, FPS, loop behavior, and direction stride. The
asset validator rejects invalid dimensions or ranges outside
`atlasFrameCount`.

Current directional PNG and SVG assets remain one-frame `idle` fallbacks:
missing `walk` or `attack` clips retain the directional sprite and existing
VFX, while a missing `death` clip retains corpse fading.

## Measurements

The retained-renderer baseline capture is stored in
[`combat-replay-retained-performance.json`](./combat-replay-retained-performance.json).
It predates sparse optional pooling. The main same-policy `zerg_rush`
comparison was:

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

The sparse slice has a deterministic structural gate: 605 ordinary visible
units use 1,815 permanent child renderables instead of 6,050. A new timing
claim must come from the same profile environment before and after the slice;
no percentage is inferred from node count alone.

The post-slice diagnostic capture is stored in
[`combat-replay-sparse-performance.json`](./combat-replay-sparse-performance.json).
An early dense desktop frame had 599 visible units with 1,797 core children
plus 11 active flash graphics, exactly 1,808 children. The longer timing
capture ended later in the fight: desktop had 365 visible units and 1,136
children; constrained mobile had 155 visible units and 483 children.

## Verification

- Unit tests cover the three-child regular unit, optional object reuse,
  stable geometry, isolated HP updates, and retained debug overlays.
- Visual tests cover clip priority, stationary attack facing, atlas timing,
  fallback behavior, and atlas range validation.
- Runtime tests cover replay-time and visual-state reconstruction through
  seek and rewind.
- Profiler tests cover warm-up exclusion, bounded samples, JSON versioning,
  scene graph metrics, and explicit query activation.
- Pixi E2E covers desktop/mobile rendering, overlays, seek/rewind, dense LOD,
  direct sprite assets, hidden profile export, and zero rebuilds while paused.
- Production smoke verifies that the profile request has no effect without
  the query flag.

## Next Step

Capture the same desktop and constrained-mobile profile after sparse pooling
and compare `renderSubmitMs`. The next content slice is an animated marine
atlas pilot; the runtime and fallback contract no longer need renderer
changes for that rollout. Exact Y ordering remains intentionally unchanged.
