import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsSingleDamage } from './damage-system'
import { resolveEcsDeath } from './death-system'
import { applyEcsOnHitEffects } from './on-hit-system'

export interface EcsSecondaryHitOptions {
  allowMinimumDamage?: boolean
  applyOnHitEffects?: boolean
  emitAttackIntent?: boolean
  interceptable?: boolean
}

export function resolveEcsSecondaryHit(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  options: EcsSecondaryHitOptions = {},
): void {
  const attacker = world.stores.identity.require(attackerId).id
  const target = world.stores.identity.require(targetId).id
  if (options.emitAttackIntent) actions.push({ unitId: attacker, type: 'attack', targetId: target })
  const result = applyEcsSingleDamage(world, attackerId, targetId, rawDamage, actions, {
    allowPercentHpDamage: false,
    allowMinimumDamage: options.allowMinimumDamage,
    interceptable: options.interceptable ?? false,
  })
  if (result.intercepted) {
    return
  }
  if (options.applyOnHitEffects !== false) {
    applyEcsOnHitEffects(world, attackerId, targetId, actions, {
      propagateSquadMark: false,
    })
  }
  resolveEcsDeath(world, targetId, attackerId, actions)
}
