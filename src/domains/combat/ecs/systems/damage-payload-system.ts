import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeStatusEffect } from '../../combat.sim.types'
import type { UnitTypeKey } from '../../combat.types'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function buildEcsDamagePayload(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
): number {
  const effects = world.stores.statusControl.require(attackerId).statusEffects
  const boost = getStatusValue(effects, 'attack_boost') ?? 0
  const boostMultiplier = boost >= 1 ? boost : 1 + boost
  const baseRaw = boost > 0
    ? Math.max(0, Math.floor(Math.floor(rawDamage) * Math.min(5, boostMultiplier)))
    : Math.floor(rawDamage)
  if (baseRaw <= 0) return 0
  const percentDamage = getPercentHpDamage(world, attackerId, targetId)
  if (percentDamage > 0) {
    actions.push({
      unitId: world.stores.identity.require(attackerId).id,
      type: 'percent_hp_damage',
      targetId: world.stores.identity.require(targetId).id,
      value: percentDamage,
    })
  }
  return baseRaw + percentDamage
}

function getPercentHpDamage(world: CombatWorld, attackerId: EntityId, targetId: EntityId): number {
  const identity = world.stores.identity.require(attackerId)
  const config = UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats.percentHpDamage
  if (!config) return 0
  const vitality = world.stores.vitality.require(targetId)
  const basis = (config.basis ?? 'max') === 'current' ? vitality.hp : vitality.maxHp
  let damage = Math.max(0, Math.floor(basis * config.percent))
  if (config.minBonus !== undefined) damage = Math.max(damage, Math.floor(config.minBonus))
  if (config.maxBonus !== undefined) damage = Math.min(damage, Math.floor(config.maxBonus))
  return Math.max(0, damage)
}

function getStatusValue(effects: RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0 || effect.value === undefined) continue
    value = value === undefined ? effect.value : Math.max(value, effect.value)
  }
  return value
}
