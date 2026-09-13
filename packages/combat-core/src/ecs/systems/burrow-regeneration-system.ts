import type { BattleAction } from '../../combat.actions.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { applyEcsHealing } from './healing-system.js'
import { compareEntityExternalIdsForMode } from '../authored-order.js'

export function runEcsBurrowRegenerationSystem(
  world: CombatWorld,
  actions: BattleAction[],
  entityIds = getEcsBurrowRegenerationEntities(world),
): void {
  const burrowed = entityIds
    .filter(entityId => world.stores.movement.require(entityId).isBurrowed)
    .sort((left, right) =>
      compareEntityExternalIdsForMode(world, left, right),
    )

  for (const entityId of burrowed) {
    const vitality = world.stores.vitality.require(entityId)
    const movement = world.stores.movement.require(entityId)
    const regen = Math.max(
      1,
      Math.floor(
        vitality.maxHp * (movement.burrowConfig?.regenPercentPerTick ?? 0),
      ),
    )
    const actualHeal = applyEcsHealing(
      world,
      entityId,
      entityId,
      regen,
    )
    if (actualHeal <= 0) continue
    const externalId = world.stores.identity.require(entityId).id
    actions.push({
      unitId: externalId,
      type: 'burrow_regen',
      targetId: externalId,
      damage: actualHeal,
    })
  }
}

export function getEcsBurrowRegenerationEntities(
  world: CombatWorld,
): readonly EntityId[] {
  return world.query(['identity', 'vitality', 'movement', 'burrowRegenerationCapability'])
}
