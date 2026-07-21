import type { BattleAction } from '../../combat.actions'
import type { TargetMarkConfig } from '../../combat.primitives'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsStatus } from './status-application-system'

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
  if (weapon.appliesEmp) {
    applyEcsStatus(world, targetId, {
      type: 'emp',
      duration: 30,
      sourceUnitId: attacker.id,
    }, actions)
  }
  for (const status of weapon.statusOnHit ?? []) {
    applyEcsStatus(world, targetId, { ...status, sourceUnitId: attacker.id }, actions)
  }
  if (weapon.markOnHit) {
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

function applyEcsTargetMark(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  mark: TargetMarkConfig,
  actions: BattleAction[],
  propagateSquad: boolean,
): void {
  const attacker = world.stores.identity.require(attackerId)
  const target = world.stores.identity.require(targetId)
  world.stores.statusControl.require(targetId).targetMark = { ...mark, sourceUnitId: attacker.id }
  actions.push({
    unitId: attacker.id,
    type: 'target_mark',
    targetId: target.id,
    value: mark.damageMultiplier ?? mark.executeThreshold ?? mark.focusPriority,
  })
  if (!propagateSquad || !mark.squadWide || !target.squadId) return
  for (const squadmateId of world.query(['identity', 'statusControl'])) {
    if (squadmateId === targetId) continue
    const squadmate = world.stores.identity.require(squadmateId)
    if (squadmate.team !== target.team || squadmate.squadId !== target.squadId) continue
    world.stores.statusControl.require(squadmateId).targetMark = { ...mark, sourceUnitId: attacker.id }
  }
  if (!mark.sharedDamage || (mark.focusPriority ?? 0) <= 0) return
  for (const allyId of world.query(['identity', 'targeting', 'entityTargets'])) {
    if (allyId === attackerId) continue
    const ally = world.stores.identity.require(allyId)
    if (ally.team !== attacker.team) continue
    world.stores.targeting.require(allyId).aggroLockTicks = 0
    world.stores.entityTargets.require(allyId).attackTarget = undefined
  }
}
