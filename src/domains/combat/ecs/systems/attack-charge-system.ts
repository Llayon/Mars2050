import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function consumeEcsAttackCharge(
  world: CombatWorld,
  entityId: EntityId,
  damage: number,
  actions: BattleAction[],
  tick: number,
): number {
  const charge = world.stores.lifecycle.require(entityId).attackCharge
  if (!charge || charge.stacks <= 0) return damage
  const multiplier = 1 + charge.attackMultPerStack * charge.stacks
  const boosted = Math.max(0, Math.floor(damage * multiplier))
  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'attack_charge_release',
    value: charge.stacks,
    damage: boosted - damage,
  })
  charge.stacks = 0
  charge.nextTick = tick + Math.max(1, charge.intervalTicks)
  return boosted
}
