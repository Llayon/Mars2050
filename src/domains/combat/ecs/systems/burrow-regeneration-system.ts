import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsHealing } from './healing-system'

export function runEcsBurrowRegenerationSystem(
  world: CombatWorld,
  actions: BattleAction[],
  entityIds = getEcsBurrowRegenerationEntities(world),
): void {
  const burrowed = entityIds
    .filter(entityId => world.stores.movement.require(entityId).isBurrowed)
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
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
): EntityId[] {
  return world.query(['identity', 'vitality', 'movement', 'burrowRegenerationCapability'])
}
