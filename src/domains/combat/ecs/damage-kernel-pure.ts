import type { RankScalingConfig, RuntimeStatusEffect, TargetMark } from '../combat.primitives'

export function applyArmorReduction(raw: number, armor: number, armorBroken: number, pierce: number, allowMinimum: boolean): number {
  const reduction = armorBroken <= 1 ? armor * Math.max(0, armorBroken) : armorBroken
  const remaining = Math.max(0, armor - reduction)
  const afterArmor = raw - Math.floor(remaining * (1 - Math.max(0, Math.min(1, pierce))))
  return allowMinimum ? Math.max(1, afterArmor) : Math.max(0, afterArmor)
}

export function applyOutputSuppressionPure(suppression: number, damage: number): number {
  return suppression > 0 ? Math.max(0, Math.floor(damage * (1 - suppression))) : damage
}

export function applyAccuracyPure(penalty: number, resistValue: number, damage: number): number {
  if (damage <= 0 || penalty <= 0) return damage
  const resist = Math.max(0, Math.min(1, resistValue))
  const effective = Math.max(0, Math.min(0.95, penalty * (1 - resist)))
  return Math.max(0, Math.floor(damage * (1 - effective)))
}

export function applyTargetStatusesPure(effects: readonly RuntimeStatusEffect[], damage: number): number {
  const vulnerable = getStatusValuePure(effects, 'vulnerable') ?? 0
  const reduction = getStatusValuePure(effects, 'damage_reduction') ?? 0
  let result = damage
  if (vulnerable > 0) result = Math.floor(result * (1 + vulnerable))
  if (reduction > 0) result = Math.floor(result * Math.max(0, 1 - reduction))
  return Math.max(0, result)
}

export function applyMovementReductionPure(
  isMoving: boolean,
  movingReduction: number,
  isBurrowed: boolean,
  burrowReduction: number,
  revealed: boolean,
  damage: number,
): number {
  const moving = isMoving ? movingReduction : 0
  const burrow = isBurrowed && !revealed ? burrowReduction : 0
  const reduction = Math.max(0, Math.min(0.9, Math.max(moving, burrow)))
  return reduction > 0 ? Math.floor(damage * (1 - reduction)) : damage
}

export function applyFlatBlockPure(
  config: { amount: number; perRank?: number; minimumDamage?: number } | undefined,
  rank: number,
  damage: number,
): number {
  if (!config || damage <= 0) return damage
  const block = Math.max(0, Math.floor(config.amount + (config.perRank ?? 0) * Math.max(0, rank - 1)))
  return Math.max(Math.max(0, Math.floor(config.minimumDamage ?? 0)), damage - block)
}

export function applySummonCounterPure(isSummon: boolean, multiplier: number, damage: number): number {
  return isSummon && multiplier > 1 ? Math.floor(damage * multiplier) : damage
}

export function getRankMultiplierPure(sourceRank: number, targetRank: number, config?: RankScalingConfig): number {
  const relation = sourceRank === targetRank ? 'same_rank' : targetRank > sourceRank ? 'higher_rank' : 'lower_rank'
  return (config?.damageModifiers ?? [])
    .filter(item => item.relation === relation)
    .reduce((value, item) => value * Math.max(0, item.multiplier), 1)
}

export function getMarkDamageMultiplierPure(sourceExternalId: string, mark?: TargetMark): number {
  if (!mark || mark.duration <= 0 || (!mark.sharedDamage && mark.sourceUnitId !== sourceExternalId)) return 0
  return Math.max(0, mark.damageMultiplier ?? 0)
}

export function getMarkExecuteThresholdPure(sourceExternalId: string, mark?: TargetMark): number {
  if (!mark || mark.duration <= 0 || mark.sourceUnitId !== sourceExternalId) return 0
  return Math.max(0, Math.floor(mark.executeThreshold ?? 0))
}

export function getStatusValuePure(effects: readonly RuntimeStatusEffect[], type: RuntimeStatusEffect['type']): number | undefined {
  let value: number | undefined
  for (const effect of effects) {
    if (effect.type !== type || effect.duration <= 0 || effect.value === undefined) continue
    value = value === undefined ? effect.value : Math.max(value, effect.value)
  }
  return value
}

export function stableAuthoredOrdinal(targetExternalId: string, sourceExternalId: string, rawDamage: number, cause = ''): number {
  const value = `${targetExternalId}\u0000${sourceExternalId}\u0000${rawDamage}\u0000${cause}`
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}
