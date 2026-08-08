import type { BattleResult, Team, UnitRow } from '@/domains/combat/combat.types'
import type { Obstacle } from '@/domains/combat/combat.sim.types'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { FIELD_HEIGHT } from '@/domains/combat/combat.utils'
import { aggregateMatchupSamples, type MatchupMatrixResult, type MatchupSample } from './combat-matchup-matrix'

export const TIER1_MATCHUP_SEEDS = [101, 202, 303, 404, 505] as const

export type Tier1BattleRunner = (
  attackers: UnitRow[],
  defenders: UnitRow[],
  seed: number,
  obstacles: Obstacle[],
) => BattleResult

export interface EvaluateTier1MatchupInput {
  scenario: CombatBalanceScenario
  seeds: readonly number[]
  runBattle: Tier1BattleRunner
}

/**
 * Evaluates a Tier 1 scenario in its normal and vertically mirrored orientations.
 *
 * @param input Scenario, seeds, and the single battle runner dependency.
 * @returns Aggregated normal, mirrored, and combined matchup results.
 */
export function evaluateTier1MatchupAcrossSeeds({
  scenario,
  seeds,
  runBattle,
}: EvaluateTier1MatchupInput): MatchupMatrixResult {
  const samples: MatchupSample[] = []

  for (const seed of seeds) {
    samples.push({
      orientation: 'normal',
      seed,
      roleTeam: 'attacker',
      result: runBattle(cloneRows(scenario.attackers), cloneRows(scenario.defenders), seed, []),
    })
    samples.push({
      orientation: 'mirrored',
      seed,
      roleTeam: 'defender',
      result: runBattle(
        mirrorTier1Rows(scenario.defenders, 'attacker'),
        mirrorTier1Rows(scenario.attackers, 'defender'),
        seed,
        [],
      ),
    })
  }

  const matrix = aggregateMatchupSamples(samples)
  const expectedRuns = seeds.length
  if (matrix.normal.runs !== expectedRuns || matrix.mirrored.runs !== expectedRuns || matrix.combined.runs !== expectedRuns * 2) {
    throw new Error(`Tier 1 matchup run count mismatch for ${scenario.id}`)
  }
  return matrix
}

export function mirrorTier1Rows(rows: readonly UnitRow[], team: Team): UnitRow[] {
  return rows.map(unit => ({
    ...unit,
    id: `mirror-${unit.id}`,
    colony_id: team,
    upgrade_path: [...(unit.upgrade_path ?? [])],
    grid_y: String(FIELD_HEIGHT - Number(unit.grid_y)),
  }))
}

function cloneRows(rows: readonly UnitRow[]): UnitRow[] {
  return rows.map(unit => ({ ...unit, upgrade_path: [...(unit.upgrade_path ?? [])] }))
}
