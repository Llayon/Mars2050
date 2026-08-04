# Combat ECS Ability Programs

Ability definitions are compiled before a battle into deterministic programs.
They are stored on the weapon component and grouped by trigger (`hit`,
`weapon_attack`, `post_weapon_attack`, or `projectile_impact`). The hot loop executes compiled
operations; it does not interpret the authored configuration.

Missile Buggy now uses an authored `projectile_impact` program for its primary
damage. EMP Drone uses an authored `hit` program for EMP application. Existing
runtime overrides and legacy test fixtures continue through the compatibility
path until their parity gates are complete.

Legacy geometry flags are also represented as typed compiled programs. Normal
compiled entities, including structural summons, execute those programs. Only
`createRuntimeUnitFromConfig` fixtures use the `legacy_mutable` fallback so
post-creation test overrides remain valid.

Status-on-hit units and Scout/Bounty Hunter marks use authored `hit` programs.
The compatibility fields remain only for mutable fixtures; compiled entities
execute the adapter once and suppress legacy component fallback to prevent
duplicate status or mark events.
Target designation and allied retargeting live in `target-mark-system.ts`, so
the ability executor and on-hit adapter no longer depend on each other.

Support auras use the same compiled representation through the `support_aura`
effect. Authoritative entities execute these programs in the support-aura ECS
system; runtime-factory entities retain extracted aura data as a compatibility
fallback. This keeps upgrades and future periodic capabilities on one compiled
path without interpreting authored definitions in the tick hot loop.

Periodic payloads are compiled into `periodic_payload` programs with a separate
runtime schedule (`periodicProgramState`). The periodic ECS system resolves the
compiled payload by program id, while runtime-spawn entities continue using
`periodicAbilities` directly until their inheritance overrides are compiled.

The public `supportAuras` snapshot field remains as a read-only projection for
replay and upgrade UI compatibility; authoritative phase execution reads
`supportPrograms`. Legacy `statusOnHit` and `markOnHit` are no longer present in
the unit catalog and remain supported only for explicit mutable fixtures.

The `abilityExecutionMode` runtime rule selects the path explicitly. Authored
programs execute in both modes; legacy adapter programs and legacy component
fields execute only in their matching mode.

Displacement abilities (`gravity_manipulator` pull and
`sonic_devastator` knockback) are also authored area effects. They execute in
`post_weapon_attack` after primary damage and weapon geometry, using the
primary target as a stable pull anchor. Their former
`pullOnHit`/`knockbackOnHit` catalog flags are no longer used by production
unit definitions.

`splitFire` and `chainAttack` now use typed `split_fire` and `chain_attack`
effects. Their ECS executors accept the compiled config directly, so authored
runtime entities no longer need weapon-side geometry fields for these attacks.

The same path now covers `side_weapon` and `barrage_attack`; Goliath and
Artillery Crawler production definitions no longer carry those legacy geometry
flags. Manual compatibility fixtures may still populate the old component
fields for focused low-level tests.

Directional attacks now use typed `line_pierce`, `cone_attack`, and
`beam_attack` effects. The directional executor accepts those compiled
overrides, while its weapon-field path remains available for legacy fixtures.
