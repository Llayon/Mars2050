# Combat ECS v8: Temporal Attacks

v8 introduces delayed attack delivery for the Missile Buggy and artillery.
Attacks now have a wind-up, launch and impact tick. Pending impacts live in a
deterministic tick-indexed queue rather than as ECS entities.

Temporal attacks use the same range, cooldown, status and stance preflight as
instant attacks. A unit may begin wind-up while it is still turning toward a
valid target; instant attacks retain their strict facing check. Deploying a
stance consumes the setup action first and emits `stance_change` before any
wind-up begins.

The post-action order is movement, projectile impact, then hazards. A launched
impact is therefore resolved against the current battlefield state; a missile
tracks its target until impact, while artillery keeps the ground point captured
when the wind-up began. Pending impacts also prevent premature elimination
outcomes.

Instant weapons retain the v7 behavior. Interception remains opt-in through
the delivery config and is evaluated at the impact coordinate. Replay receives
explicit `attack_windup`, `projectile_launch`, `projectile_impact`,
`projectile_miss`, and `attack_cancel` actions.

## Verification

Temporal behavior is covered by `combat.ecs-v8-temporal.test.ts`, including
wind-up, launch, impact, cancellation, interception, tracking, and artillery
ground targeting. The release gate is:

```text
npm test
npx tsc --noEmit --pretty false
npx tsx scripts/check-limits.ts --diff HEAD --json
```

The V8 baseline currently passes 167 test files and 613 tests with no
architecture-gate violations.
