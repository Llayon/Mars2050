import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { UnitTypeKey } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function applyEcsPrimaryDamageModifiers(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  baseDamage: number,
  actions: BattleAction[],
): number {
  const rampedDamage = applyRampDamage(world, attackerId, targetId, baseDamage, actions)
  return applyChargeDamage(world, attackerId, targetId, rampedDamage, actions)
}

function applyRampDamage(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  damage: number,
  actions: BattleAction[],
): number {
  const identity = world.stores.identity.require(attackerId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats.rampDamage
  if (!config) return damage
  const targeting = world.stores.targeting.require(attackerId)
  const refs = world.stores.entityTargets.require(attackerId)
  const previousMultiplier = refs.rampTarget === targetId ? targeting.rampMultiplier ?? 1 : 1
  const multiplier = refs.rampTarget === targetId
    ? Math.min(config.maxMultiplier, previousMultiplier + config.step)
    : 1
  refs.rampTarget = targetId
  targeting.rampMultiplier = multiplier
  actions.push({
    unitId: identity.id,
    type: 'ramp_charge',
    targetId: world.stores.identity.require(targetId).id,
    value: multiplier,
  })
  return Math.floor(damage * multiplier)
}

function applyChargeDamage(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  damage: number,
  actions: BattleAction[],
): number {
  const identity = world.stores.identity.require(attackerId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats.chargeDamage
  if (!config) return damage
  const targeting = world.stores.targeting.require(attackerId)
  const chargeDistance = targeting.chargeDistance ?? 0
  targeting.chargeDistance = 0
  if (chargeDistance < config.minDistance) return damage
  const window = Math.max(1, config.maxDistance - config.minDistance)
  const ratio = Math.min(1, (chargeDistance - config.minDistance) / window)
  const multiplier = 1 + ratio * (config.maxMultiplier - 1)
  actions.push({
    unitId: identity.id,
    type: 'charge_damage',
    targetId: world.stores.identity.require(targetId).id,
    value: Math.round(multiplier * 100) / 100,
  })
  return Math.floor(damage * multiplier)
}
