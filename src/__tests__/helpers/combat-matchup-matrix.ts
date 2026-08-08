import type { BattleResult, Team } from '@/domains/combat/combat.types'

export type MatchupOrientation = 'normal' | 'mirrored'

export interface MatchupSample {
  orientation: MatchupOrientation
  seed: number
  roleTeam: Team
  result: BattleResult
}

export interface MatchupSideSummary {
  runs: number
  wins: number
  losses: number
  draws: number
  winRate: number
  totalRoleRemainingPower: number
  medianRoleRemainingPower: number | null
  medianRoleRemainingHpRatio: number | null
  medianWinningRemainingHpRatio: number | null
}

export interface MatchupMatrixResult {
  normal: MatchupSideSummary
  mirrored: MatchupSideSummary
  combined: MatchupSideSummary
  orientationWinRateDelta: number
  samples: MatchupSample[]
}

const ORIENTATION_ORDER: Record<MatchupOrientation, number> = { normal: 0, mirrored: 1 }

/**
 * Aggregates seeded normal and mirrored battle results without invoking combat code.
 *
 * @param inputSamples Battle samples to classify and aggregate.
 * @returns Canonically ordered samples and normal, mirrored, and combined summaries.
 */
export function aggregateMatchupSamples(inputSamples: readonly MatchupSample[]): MatchupMatrixResult {
  const samples = [...inputSamples].sort(compareSamples)
  const normalSamples = samples.filter(sample => sample.orientation === 'normal')
  const mirroredSamples = samples.filter(sample => sample.orientation === 'mirrored')
  const normal = summarizeSamples(normalSamples)
  const mirrored = summarizeSamples(mirroredSamples)
  const combined = summarizeSamples(samples)

  for (const summary of [normal, mirrored, combined]) {
    if (summary.wins + summary.losses + summary.draws !== summary.runs) {
      throw new Error('Matchup summary classification counts do not equal runs')
    }
  }

  return {
    normal,
    mirrored,
    combined,
    orientationWinRateDelta: normal.winRate - mirrored.winRate,
    samples,
  }
}

export const evaluateMatchupSamples = aggregateMatchupSamples

function summarizeSamples(samples: readonly MatchupSample[]): MatchupSideSummary {
  const rolePowers = samples.map(sample => roleRemainingPower(sample.result, sample.roleTeam))
  const roleHpRatios = samples.map(sample => roleRemainingHpRatio(sample.result, sample.roleTeam))
  const winningHpRatios = samples
    .filter(sample => sample.result.winner === sample.roleTeam)
    .map(sample => roleRemainingHpRatio(sample.result, sample.roleTeam))
  const wins = samples.filter(sample => sample.result.winner === sample.roleTeam).length
  const draws = samples.filter(sample => sample.result.winner === 'draw').length
  const losses = samples.length - wins - draws

  return {
    runs: samples.length,
    wins,
    losses,
    draws,
    winRate: samples.length === 0 ? 0 : wins / samples.length,
    totalRoleRemainingPower: rolePowers.reduce((total, power) => total + power, 0),
    medianRoleRemainingPower: median(rolePowers),
    medianRoleRemainingHpRatio: median(roleHpRatios),
    medianWinningRemainingHpRatio: upperMiddle(winningHpRatios),
  }
}

function roleRemainingPower(result: BattleResult, roleTeam: Team): number {
  return result.survivors
    .filter(unit => unit.team === roleTeam)
    .reduce((total, survivor) => total + survivor.hp / survivor.maxHp, 0)
}

function roleRemainingHpRatio(result: BattleResult, roleTeam: Team): number {
  const initialRoleMaxHp = result.initialState
    .filter(unit => unit.team === roleTeam)
    .reduce((total, unit) => total + unit.maxHp, 0)
  const remainingRoleHp = result.survivors
    .filter(unit => unit.team === roleTeam)
    .reduce((total, survivor) => total + survivor.hp, 0)
  return initialRoleMaxHp === 0 ? 0 : remainingRoleHp / initialRoleMaxHp
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function upperMiddle(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function compareSamples(left: MatchupSample, right: MatchupSample): number {
  return left.seed - right.seed
    || ORIENTATION_ORDER[left.orientation] - ORIENTATION_ORDER[right.orientation]
    || left.roleTeam.localeCompare(right.roleTeam)
    || left.result.winner.localeCompare(right.result.winner)
}
