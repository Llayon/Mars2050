# Combat ECS v8: Temporal Attacks

v8 introduces delayed attack delivery for the Missile Buggy and artillery.
Attacks now have a wind-up, launch and impact tick. Pending impacts live in a
deterministic tick-indexed queue rather than as ECS entities.

Temporal attacks use the same range, cooldown, status and stance preflight as
instant attacks. A unit may begin wind-up while it is still turning toward a
valid target; instant attacks retain their strict facing check. Deploying a
stance consumes the setup action first and emits `stance_change` before any
wind-up begins.

The post-action order is movement, temporal timeline, projectile impact, then
hazards. A launched impact is therefore resolved against the current
battlefield state; full-homing missiles track a live target until impact,
ordinary projectiles capture their launch position, and ground-targeted
artillery captures its point when wind-up starts. Pending impacts also prevent
premature elimination outcomes.

Instant weapons retain the v7 behavior. Temporal interception is allocated once
per impact tick from an immutable frame: threats are ordered by maximum raw
damage and impact id, while interceptors use distance and external id tie
breaks. Each shell is allocated independently at its ground point. Replay
receives actual launch/impact coordinates and explicit `attack_windup`,
`projectile_launch`, `projectile_impact`, `projectile_miss`, and `attack_cancel`
actions with cancellation reasons.

The public simulation version remains `8`, but the stabilized runtime writes
`combat-ecs-v8-stabilized-r1` as its engine revision in replay metrics. A stored
V8 replay without that revision, or with a different revision, is unsupported;
the numeric version is intentionally not reused for both simulation contracts.

## Verification

Temporal behavior is covered by `combat.ecs-v8-temporal.test.ts`, including
wind-up, launch, impact, cancellation, interception, tracking, and artillery
ground targeting. The release gate is:

```text
npm test
npx tsc --noEmit --pretty false
npx tsx scripts/check-limits.ts --diff HEAD --json
```

The checked-in V8 golden fixture is verified by the golden test and the
`combat:ecs:golden` script. The release gate above must pass with no
architecture-gate violations; the exact test count is deliberately not part of
the contract.
