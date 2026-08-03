import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export interface EcsHealingOptions {
  bypassStatusBlock?: boolean
}

export function applyEcsHealing(
  world: CombatWorld,
  sourceId: EntityId,
  targetId: EntityId,
  requestedAmount: number,
  actions?: BattleAction[],
  options?: EcsHealingOptions,
): number {
  return applyEcsHealingFromSource(
    world,
    world.stores.identity.require(sourceId).id,
    targetId,
    requestedAmount,
    actions,
    options,
  )
}

export function applyEcsHealingFromSource(
  world: CombatWorld,
  sourceExternalId: string,
  targetId: EntityId,
  requestedAmount: number,
  actions?: BattleAction[],
  options?: EcsHealingOptions,
): number {
  const target = world.stores.vitality.require(targetId)
  if (target.isDead || requestedAmount <= 0) return 0
  if (!options?.bypassStatusBlock && hasActiveBurn(world, targetId)) {
    actions?.push({
      unitId: sourceExternalId,
      type: 'heal_blocked',
      targetId: world.stores.identity.require(targetId).id,
      statusType: 'burn',
      value: Math.max(0, Math.floor(requestedAmount)),
    })
    return 0
  }
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

function hasActiveBurn(world: CombatWorld, targetId: EntityId): boolean {
  return world.stores.statusControl.require(targetId).statusEffects
    .some(effect => effect.type === 'burn' && effect.duration > 0)
}
