import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsSingleDamage } from './damage-system'
import { resolveSimpleEcsDeath } from './death-system'
import { applyEcsOnHitEffects } from './on-hit-system'

export function resolveEcsSecondaryHit(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  emitAttackIntent: boolean,
): void {
  const attacker = world.stores.identity.require(attackerId).id
  const target = world.stores.identity.require(targetId).id
  if (emitAttackIntent) actions.push({ unitId: attacker, type: 'attack', targetId: target })
  applyEcsSingleDamage(world, attackerId, targetId, rawDamage, actions, {
    allowPercentHpDamage: false,
    interceptable: false,
  })
  applyEcsOnHitEffects(world, attackerId, targetId, actions, {
    propagateSquadMark: false,
  })
  resolveSimpleEcsDeath(world, targetId, attackerId, actions)
  world.syncComponentsFromStore(targetId, ['vitality', 'defense'])
}
