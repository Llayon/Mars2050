import type { DamageClaim, DefenseBatchSnapshot } from './defense-batch'

export function resolveDamageLifesteal(
  snapshot: DefenseBatchSnapshot,
  projected: Map<string, number>,
  claim: DamageClaim,
  dealt: number,
  multiplier: number,
): number {
  const source = snapshot.targetsByExternalId.get(claim.sourceExternalId)
  if (!source || claim.sourceAliveAtGroupStart === false) return 0
  const current = projected.get(source.externalId) ?? source.hp
  return Math.min(Math.floor(dealt * Math.max(0, multiplier)), Math.max(0, (source.maxHp ?? source.hp) - current))
}
