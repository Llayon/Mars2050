import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getDamageAttributionMetadata, type DamageSourceContext } from '../damage-source'

export function buildEcsDamagePayload(
  world: CombatWorld,
  source: DamageSourceContext,
  targetId: EntityId,
  rawDamage: number,
  actions: BattleAction[],
  allowPercentHpDamage = true,
): number {
  const boost = source.modifiers.attackBoostValue
  const boostMultiplier = boost >= 1 ? boost : 1 + boost
  const baseRaw = boost > 0
    ? Math.max(0, Math.floor(Math.floor(rawDamage) * Math.min(5, boostMultiplier)))
    : Math.floor(rawDamage)
  if (baseRaw <= 0) return 0
  const percentDamage = allowPercentHpDamage
    ? getPercentHpDamage(world, source, targetId)
    : 0
  if (percentDamage > 0) {
    actions.push({
      unitId: source.attribution.sourceExternalId,
      ...getDamageAttributionMetadata(world, source.attribution),
      type: 'percent_hp_damage',
      targetId: world.stores.identity.require(targetId).id,
      value: percentDamage,
    })
  }
  return baseRaw + percentDamage
}

function getPercentHpDamage(world: CombatWorld, source: DamageSourceContext, targetId: EntityId): number {
  const config = source.modifiers.percentHpDamage
  if (!config) return 0
  const vitality = world.stores.vitality.require(targetId)
  const basis = (config.basis ?? 'max') === 'current' ? vitality.hp : vitality.maxHp
  let damage = Math.max(0, Math.floor(basis * config.percent))
  if (config.minBonus !== undefined) damage = Math.max(damage, Math.floor(config.minBonus))
  if (config.maxBonus !== undefined) damage = Math.min(damage, Math.floor(config.maxBonus))
  return Math.max(0, damage)
}
