import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function applyEcsHealing(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  requestedAmount: number,
  actions?: BattleAction[],
): number {
  return applyEcsHealingFromSource(
    world,
    world.stores.identity.require(sourceId).id,
    targetId,
    requestedAmount,
    actions,
  )
}

export function applyEcsHealingFromSource(
  world: CombatWorld,
  sourceExternalId: string,
  targetId: EntityId,
  requestedAmount: number,
  actions?: BattleAction[],
): number {
  const target = world.stores.vitality.require(targetId)
  if (target.isDead || requestedAmount <= 0) return 0
  const before = Math.max(0, Math.min(target.maxHp, target.hp))
  target.hp = Math.min(target.maxHp, before + Math.max(0, Math.floor(requestedAmount)))
  const actualHeal = target.hp - before
  if (actualHeal <= 0) return 0
  actions?.push({
    unitId: sourceExternalId,
    type: 'heal',
    targetId: world.stores.identity.require(targetId).id,
    damage: actualHeal,
  })
  return actualHeal
}
