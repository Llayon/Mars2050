import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'
import { hasCompiledHitAbility, runCompiledAbilityTrigger } from './ability-effect-system'
import { applyEcsTargetMark } from './target-mark-system'
import type { DamageOrderKey } from '../defense-batch'

export interface EcsOnHitOptions {
  propagateSquadMark?: boolean
  authoredKey?: DamageOrderKey
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
  const statusOffset = weapon.appliesEmp ? 1 : 0
  runCompiledAbilityTrigger(world, attackerId, targetId, 'hit', actions, undefined, {
    hitKind: options.propagateSquadMark === false ? 'secondary' : 'primary',
  })
  if (weapon.appliesEmp) {
    applyEcsStatus(world, targetId, {
      type: 'emp',
      duration: 30,
      sourceUnitId: attacker.id,
    }, actions, withEffectIndex(options.authoredKey, 1))
  }
  if (!authoredHit) {
    for (const [effectIndex, status] of (weapon.statusOnHit ?? []).entries()) {
      applyEcsStatus(world, targetId, { ...status, sourceUnitId: attacker.id }, actions, withEffectIndex(options.authoredKey, effectIndex + 1 + statusOffset))
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
      withEffectIndex(options.authoredKey, (weapon.statusOnHit?.length ?? 0) + 1 + statusOffset),
    )
  }
}

function withEffectIndex(key: DamageOrderKey | undefined, effectIndex: number): DamageOrderKey | undefined {
  return key ? { ...key, position: { ...key.position, effectIndex } } : undefined
}

