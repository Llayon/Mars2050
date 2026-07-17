import type { BattleAction } from '../../combat.actions'
import { movementSystem } from '../../combat.movement'
import type { RuntimeMovementContext } from '../../combat.runtime'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

/**
 * Owns ECS movement phase synchronization while legacy movement math is ported.
 * @param world Combat ECS world
 * @param entityId Moving entity
 * @param targetId Current target entity
 * @param actions Replay action sink
 * @param context Deterministic movement resources
 */
export function runMovementSystem(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeMovementContext,
): void {
  const unit = world.getEntity(entityId)
  const target = world.getEntity(targetId)
  if (!unit || !target) return

  movementSystem(
    unit,
    target,
    world.roster,
    actions,
    context.dt,
    context.rng,
    context.flowField,
    context.obstacles,
    context.spatialHash,
  )

  world.syncEntityToComponents(entityId)
  context.spatialHash.update(unit)
  world.resources.require('entitySpatial').update(world, entityId)
}
