import { getUnitRank as getCoreUnitRank, applyRankScaling, type RankScaledStats } from '@mars2050/combat-core'

export { applyRankScaling, type RankScaledStats }

export function getUnitRank(unit: { rank?: number | null; tier?: number | null }): number {
  return getCoreUnitRank({ rank: unit.rank ?? unit.tier ?? 1 })
}
