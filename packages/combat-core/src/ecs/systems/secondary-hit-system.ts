import type { BattleAction } from '../../combat.actions.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { applyEcsSingleDamage } from './damage-system.js'
import { resolveEcsDeath } from './death-system.js'
import { applyEcsOnHitEffects } from './on-hit-system.js'

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
    originExternalId: `unit:${attacker}:secondary`,
    authoredOrdinal: 0,
    authoredPosition: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
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
