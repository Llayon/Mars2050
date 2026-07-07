import type { RankRelation, RankScalingConfig, SimUnit } from './combat.sim.types'
import type { UnitRow } from './combat.types'

export interface RankScaledStats {
  hp: number
  attack: number
  defense: number
  range: number
  cooldown: number
}

export function getUnitRank(unit: Pick<UnitRow, 'tier'>): number {
  const rank = Number(unit.tier ?? 1)
  return Number.isFinite(rank) ? Math.max(1, Math.floor(rank)) : 1
}

export function applyRankScaling(stats: RankScaledStats, config: RankScalingConfig | undefined, rank: number): RankScaledStats {
  if (!config) return stats
  const steps = Math.max(0, Math.floor(rank) - 1)
  const hpMult = 1 + Math.max(-0.95, config.hpMultPerRank ?? 0) * steps
  const attackMult = 1 + Math.max(-0.95, config.attackMultPerRank ?? 0) * steps
  const cooldownReduction = Math.max(0, Math.min(0.95, config.cooldownReductionPerRank ?? 0)) * steps

  return {
    hp: Math.max(1, stats.hp * Math.max(0.05, hpMult)),
    attack: Math.max(0, stats.attack * Math.max(0.05, attackMult)),
    defense: Math.max(0, stats.defense + Math.max(0, config.defenseAddPerRank ?? 0) * steps),
    range: Math.max(0, stats.range + Math.max(0, config.rangeAddPerRank ?? 0) * steps),
    cooldown: Math.max(1, stats.cooldown * Math.max(0.05, 1 - cooldownReduction)),
  }
}

export function getRankDamageMultiplier(attacker: SimUnit, target: SimUnit): number {
  let multiplier = 1
  for (const modifier of attacker.rankScaling?.damageModifiers ?? []) {
    if (getRankRelation(attacker, target) === modifier.relation) multiplier *= Math.max(0, modifier.multiplier)
  }
  return multiplier
}

export function getRankRelation(source: Pick<SimUnit, 'rank'>, target: Pick<SimUnit, 'rank'>): RankRelation {
  const sourceRank = source.rank ?? 1
  const targetRank = target.rank ?? 1
  if (sourceRank === targetRank) return 'same_rank'
  return targetRank > sourceRank ? 'higher_rank' : 'lower_rank'
}
