import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleResult, Team, UnitRow } from '@/domains/combat/combat.types'
import { generateObstacles } from '@/domains/combat/combat.utils'
import { runCertifiedProductionCombat } from './helpers/combat-production-runner'
import { evaluateTier1MatchupAcrossSeeds, mirrorTier1Rows, TIER1_MATCHUP_SEEDS } from './helpers/combat-tier1-matchup'

describe('Tier 1 placement and support value', () => {
  it('changes explosive-drone and jetpack outcomes through matchup and deployment', () => {
    const droneBreach = evaluateMatchup(findScenario('tier1_explosive_drone_vs_walker')).combined.wins
    const droneScreened = evaluateMatchup(findScenario('tier1_explosive_drone_screened_out')).combined.wins
    const jetpackFlank = evaluateMatchup(findScenario('tier1_jetpack_open_flank')).combined.totalRoleRemainingPower
    const jetpackCenter = evaluateMatchup(findScenario('tier1_jetpack_center_lane')).combined.totalRoleRemainingPower

    expect(droneBreach).toBeGreaterThanOrEqual(droneScreened + 6)
    expect(jetpackFlank).toBeGreaterThan(jetpackCenter * 1.5)
  }, 30000)

  it('makes a medic materially improve a five-squad line', () => {
    const scenario = findScenario('tier1_medic_sustain_check')
    const medic = simulateScenario(scenario, 101, true)
    const control = runCertifiedProductionCombat(
      cloneRows(scenario.attackers.filter(unit => unit.unit_type !== 'medic')),
      cloneRows(scenario.defenders),
      101,
      [],
      [],
      [],
      { trackMetrics: true },
    )

    expect(remainingPower(medic, 'defender'))
      .toBeLessThan(remainingPower(control, 'defender') * 0.92)
    expect(medic.metrics?.healingDoneByUnitType.medic ?? 0).toBeGreaterThan(500)
  }, 30000)

  it('keeps scout marking useful but answerable by the heavy gunner', () => {
    const focusScenario = findScenario('tier1_scout_focus_fire')
    const focus = simulateScenario(focusScenario, 101, true)
    const focusGate = evaluateMatchup(focusScenario).combined
    const defaultObstacles = generateObstacles(12345)
    const defaultSetup = runCertifiedProductionCombat(cloneRows(focusScenario.attackers), cloneRows(focusScenario.defenders), 12345, defaultObstacles)
    const mirroredSetup = runCertifiedProductionCombat(
      mirrorTier1Rows(focusScenario.defenders, 'attacker'),
      mirrorTier1Rows(focusScenario.attackers, 'defender'),
      12345,
      defaultObstacles,
    )
    const counter = simulateScenario(findScenario('tier1_scout_countered_by_heavy'), 101, true)
    const focusActions = focus.logs.flatMap(log => log.actions)

    expect(focusActions.filter(action => action.type === 'target_mark').length).toBeGreaterThan(5)
    expect(focusGate.wins).toBeGreaterThanOrEqual(7)
    expect(focusGate.wins).toBeLessThanOrEqual(10)
    expect(focusGate.medianWinningRemainingHpRatio ?? 0).toBeGreaterThanOrEqual(0.1)
    expect(focusGate.medianWinningRemainingHpRatio ?? 0).toBeLessThanOrEqual(0.25)
    expect(focus.winner).toBe('attacker')
    expect(focus.metrics?.mark.markUtilization ?? 0).toBeGreaterThan(0.25)
    expect(focus.metrics?.mark.bonusDamageFromMarks ?? 0).toBeGreaterThan(0)
    expect(defaultSetup.winner).not.toBe('draw')
    expect(mirroredSetup.winner).not.toBe('draw')
    expect(mirroredSetup.logs.flatMap(log => log.actions)
      .filter(action => action.type === 'target_mark').length).toBeGreaterThan(5)
    expect(counter.winner).toBe('defender')
    expect(counter.metrics?.damageByUnitType.heavy_gunner ?? 0).toBeGreaterThan(0)
    expect(counter.survivors.some(unit => unit.team === 'attacker' && unit.type === 'scout_drone')).toBe(false)
  }, 30000)

  it('lets five marines plus a scout beat six marines in the legal screenshot formation', () => {
    const attackers = [150, 210, 330, 390, 450, 270]
      .map((x, index) => positionedRow(`screenshot-a-${index}`, 'marine', 'attacker', x, 930))
    const defenders = [150, 210, 330, 390, 270]
      .map((x, index) => positionedRow(`screenshot-d-${index}`, 'marine', 'defender', x, 570))
    defenders.push(positionedRow('screenshot-scout', 'scout_drone', 'defender', 270, 510))

    const result = runCertifiedProductionCombat(attackers, defenders, 12345, [])

    expect(result.winner).toBe('attacker')
    expect(result.survivors.some(unit => unit.team === 'attacker' && unit.type === 'marine')).toBe(true)
  })

  it('keeps a dense grenadier battery answerable by mobile and sustained counters', () => {
    const xs = [240, 300, 360]
    for (const counter of ['heavy_gunner', 'scavenger_buggy', 'jetpack_trooper'] as const) {
      const grenadiers = xs.map((x, index) =>
        positionedRow(`grenadier-a-${index}`, 'grenadier', 'attacker', x, 900))
      const defenders = xs.map((x, index) =>
        positionedRow(`${counter}-d-${index}`, counter, 'defender', x, 300))
      const normal = runCertifiedProductionCombat(grenadiers, defenders, 101, [])
      const mirrored = runCertifiedProductionCombat(
        mirrorTier1Rows(defenders, 'attacker'),
        mirrorTier1Rows(grenadiers, 'defender'),
        101,
        [],
      )

      expect(normal.winner, counter).toBe('defender')
      expect(mirrored.winner, counter).toBe('attacker')
    }

    expect(simulateScenario(findScenario('tier1_grenadier_vs_clump'), 101).winner)
      .toBe('defender')
  })
})

function simulateScenario(scenario: CombatBalanceScenario, seed: number, trackMetrics = false): BattleResult {
  return runCertifiedProductionCombat(cloneRows(scenario.attackers), cloneRows(scenario.defenders), seed, [], [], [], { trackMetrics })
}

function evaluateMatchup(scenario: CombatBalanceScenario) {
  return evaluateTier1MatchupAcrossSeeds({
    scenario,
    seeds: TIER1_MATCHUP_SEEDS,
    runBattle: runCertifiedProductionCombat,
  })
}

function findScenario(scenarioId: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(candidate => candidate.id === scenarioId)
  if (!scenario) throw new Error(`Missing Tier 1 scenario: ${scenarioId}`)
  return scenario
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(unit => ({ ...unit, upgrade_path: [...(unit.upgrade_path ?? [])] }))
}

function positionedRow(id: string, type: UnitRow['unit_type'], team: Team, x: number, y: number): UnitRow {
  return {
    id,
    colony_id: team,
    unit_type: type,
    hp_current: UNIT_TYPES[type].baseStats.hp,
    tier: 1,
    upgrade_path: [],
    grid_x: String(x),
    grid_y: String(y),
  }
}

function remainingPower(result: BattleResult, team: Team): number {
  return result.survivors
    .filter(unit => unit.team === team)
    .reduce((total, unit) => total + unit.hp / unit.maxHp, 0)
}
