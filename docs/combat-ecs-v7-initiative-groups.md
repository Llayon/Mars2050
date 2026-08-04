# Combat ECS v7: initiative groups

Simulation v7 resolves actors in exact-speed initiative groups. Faster groups
still act first, while entities with the same combat speed first produce their
action intents and then commit HP changes as one group.

## Transaction boundary

At the start of a group the ledger captures HP for all live entities. Damage
and healing are queued while actions execute, then committed as:

`start HP + queued healing - queued damage`

Status applications are queued as well. Their replay events and component
mutations are committed after the group, so an EMP, burn, or other status
cannot disable an actor that already planned in the same group.

Death candidates are marked before `resolveEcsDeath` runs. This keeps mutual
kills deterministic and prevents on-kill effects from depending on entity
iteration order. Damage ties use the largest contribution and external unit
ID as the stable tie-breaker.

Targeting and movement reservations still use the existing ECS systems.
Spawn, mine, smoke, and trigger creations remain structural commands, so they
are flushed only after the group commit.

## Replay contract

`CURRENT_SIMULATION_VERSION` is `7`. The v7 golden fixture covers ranged,
summon, control, transform, primitive-event, and zerg presets. A new action
kind or resolution-order change requires regenerating those hashes and adding
an explicit regression test.

## Follow-up slices

1. Freeze per-group defensive allocations and status reads in an immutable
   frame.
2. Add permutation gates for mixed-speed and mixed-size formations.
3. Compare group metrics against the sequential baseline before enabling the
   mode for networked PvP.
