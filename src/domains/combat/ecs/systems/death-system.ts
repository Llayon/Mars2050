import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function resolveSimpleEcsDeath(
  world: CombatWorld,
  targetId: EntityId,
  sourceId: EntityId,
  actions: BattleAction[],
): boolean {
  const target = world.stores.vitality.require(targetId)
  if (target.isDead || target.hp > 0) return false
  target.isDead = true
  actions.push({
    unitId: world.stores.identity.require(targetId).id,
    type: 'die',
    sourceUnitId: world.stores.identity.require(sourceId).id,
    cause: 'weapon',
  })
  return true
}
