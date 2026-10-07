import { getUnitRank as getCoreUnitRank } from '@mars2050/combat-core/combat.rank-scaling'

export * from '@mars2050/combat-core/combat.rank-scaling'

export function getUnitRank(unit: { rank?: number | null; tier?: number | null }): number {
  return getCoreUnitRank({ rank: unit.rank ?? unit.tier ?? 1 })
}
