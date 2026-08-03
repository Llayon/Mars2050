import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleResult, Team, UnitRow } from '@/domains/combat/combat.types'
import { FIELD_HEIGHT, generateObstacles } from '@/domains/combat/combat.utils'

const SEEDS = [101, 202, 303, 404, 505]

describe('Tier 1 placement and support value', () => {
  it('changes explosive-drone and jetpack outcomes through matchup and deployment', () => {
    const droneBreach = mirroredWins(findScenario('tier1_explosive_drone_vs_walker'))
    const droneScreened = mirroredWins(findScenario('tier1_explosive_drone_screened_out'))
    const jetpackFlank = mirroredRolePower(findScenario('tier1_jetpack_open_flank'))
    const jetpackCenter = mirroredRolePower(findScenario('tier1_jetpack_center_lane'))

    expect(droneBreach).toBeGreaterThanOrEqual(droneScreened + 6)
    expect(jetpackFlank).toBeGreaterThan(jetpackCenter * 1.5)
  }, 30000)

  it('makes a medic materially improve a five-squad line', () => {
    const scenario = findScenario('tier1_medic_sustain_check')
    const medic = simulateScenario(scenario, 101, true)
    const control = simulateBattle(
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
    const defaultObstacles = generateObstacles(12345)
    const defaultSetup = simulateBattle(cloneRows(focusScenario.attackers), cloneRows(focusScenario.defenders), 12345, defaultObstacles)
    const mirroredSetup = simulateBattle(
      mirrorRows(focusScenario.defenders, 'attacker'),
      mirrorRows(focusScenario.attackers, 'defender'),
      12345,
      defaultObstacles,
    )
    const counter = simulateScenario(findScenario('tier1_scout_countered_by_heavy'), 101, true)
    const focusActions = focus.logs.flatMap(log => log.actions)

    expect(focusActions.filter(action => action.type === 'target_mark').length).toBeGreaterThan(5)
    expect(focus.winner).toBe('attacker')
    expect(defaultSetup.winner).toBe('attacker')
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

    const result = simulateBattle(attackers, defenders, 12345, [])

    expect(result.winner).toBe('defender')
    expect(result.survivors.some(unit => unit.team === 'defender' && unit.type === 'marine')).toBe(true)
  })

  it('keeps a dense grenadier battery answerable by mobile and sustained counters', () => {
    const xs = [240, 300, 360]
    for (const counter of ['heavy_gunner', 'scavenger_buggy', 'jetpack_trooper'] as const) {
      const grenadiers = xs.map((x, index) =>
        positionedRow(`grenadier-a-${index}`, 'grenadier', 'attacker', x, 900))
      const defenders = xs.map((x, index) =>
        positionedRow(`${counter}-d-${index}`, counter, 'defender', x, 300))
      const normal = simulateBattle(grenadiers, defenders, 101, [])
      const mirrored = simulateBattle(
        mirrorRows(defenders, 'attacker'),
        mirrorRows(grenadiers, 'defender'),
        101,
        [],
      )

      expect(normal.winner, counter).toBe('defender')
      expect(mirrored.winner, counter).toBe('attacker')
    }

    expect(simulateScenario(findScenario('tier1_grenadier_vs_clump'), 101).winner)
      .toBe('attacker')
  })
})

function mirroredWins(scenario: CombatBalanceScenario): number {
  let wins = 0
  for (const seed of SEEDS) {
    const normal = simulateScenario(scenario, seed)
    if (normal.winner === 'attacker') wins++

    const mirrored = simulateBattle(
      mirrorRows(scenario.defenders, 'attacker'),
      mirrorRows(scenario.attackers, 'defender'),
      seed,
      [],
    )
    if (mirrored.winner === 'defender') wins++
  }
  return wins
}

function mirroredRolePower(scenario: CombatBalanceScenario): number {
  let power = 0
  for (const seed of SEEDS) {
    power += remainingPower(simulateScenario(scenario, seed), 'attacker')
    const mirrored = simulateBattle(
      mirrorRows(scenario.defenders, 'attacker'),
      mirrorRows(scenario.attackers, 'defender'),
      seed,
      [],
    )
    power += remainingPower(mirrored, 'defender')
  }
  return power
}

function simulateScenario(scenario: CombatBalanceScenario, seed: number, trackMetrics = false): BattleResult {
  return simulateBattle(cloneRows(scenario.attackers), cloneRows(scenario.defenders), seed, [], [], [], { trackMetrics })
}

function findScenario(scenarioId: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(candidate => candidate.id === scenarioId)
  if (!scenario) throw new Error(`Missing Tier 1 scenario: ${scenarioId}`)
  return scenario
}

function mirrorRows(rows: UnitRow[], team: Team): UnitRow[] {
  return rows.map(unit => ({
    ...unit,
    id: `mirror-${unit.id}`,
    colony_id: team,
    upgrade_path: [...(unit.upgrade_path ?? [])],
    grid_y: String(FIELD_HEIGHT - Number(unit.grid_y)),
  }))
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
