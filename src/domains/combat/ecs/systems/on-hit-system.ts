import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'
import { hasCompiledHitAbility, runCompiledAbilityTrigger } from './ability-effect-system'
import { applyEcsTargetMark } from './target-mark-system'

export interface EcsOnHitOptions {
  propagateSquadMark?: boolean
}
export function applyEcsOnHitEffects(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  options: EcsOnHitOptions = {},
): void {
  if (world.stores.vitality.require(targetId).isDead) return
  const attacker = world.stores.identity.require(attackerId)
  const weapon = world.stores.weapon.require(attackerId)
  const authoredHit = hasCompiledHitAbility(world, attackerId)
  runCompiledAbilityTrigger(world, attackerId, targetId, 'hit', actions, undefined, {
    hitKind: options.propagateSquadMark === false ? 'secondary' : 'primary',
  })
  if (weapon.appliesEmp) {
    applyEcsStatus(world, targetId, {
      type: 'emp',
      duration: 30,
      sourceUnitId: attacker.id,
    }, actions)
  }
  if (!authoredHit) {
    for (const status of weapon.statusOnHit ?? []) {
      applyEcsStatus(world, targetId, { ...status, sourceUnitId: attacker.id }, actions)
    }
  }
  if (!authoredHit && weapon.markOnHit) {
    applyEcsTargetMark(
      world,
      attackerId,
      targetId,
      weapon.markOnHit,
      actions,
      options.propagateSquadMark !== false,
    )
  }
}

