import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { V8_SIMULATION_REVISION, V8_SIMULATION_VERSION, V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'

const CHARACTERIZATION_SEED = 24680
const REPRESENTATIVE_SCENARIOS = [
  'tier1_marine_baseline_duel',
  'tier1_explosive_drone_vs_walker',
  'tier1_medic_sustain_check',
  'tier1_grenadier_vs_clump',
  'tier1_scout_focus_fire',
]

const ROLE_SIGNAL_GATES: {
  scenarioId: string
  actionTypes: BattleActionType[]
  statusType?: string
}[] = [
  { scenarioId: 'tier1_heavy_gunner_sustained_line', actionTypes: ['status_apply', 'split_fire'], statusType: 'output_suppressed' },
  { scenarioId: 'tier1_flamethrower_vs_shock_screen', actionTypes: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_jetpack_open_flank', actionTypes: ['mode_change'] },
  { scenarioId: 'tier1_scout_focus_fire', actionTypes: ['target_mark'] },
  { scenarioId: 'tier1_medic_sustain_check', actionTypes: ['heal'] },
  { scenarioId: 'tier1_explosive_drone_vs_walker', actionTypes: ['self_destruct', 'percent_hp_damage'] },
  { scenarioId: 'tier1_buggy_charge_flank', actionTypes: ['charge_damage'] },
]

const ROLE_ACTIVITY_GATES: { scenarioId: string; unitType: string }[] = [
  { scenarioId: 'tier1_heavy_gunner_sustained_line', unitType: 'heavy_gunner' },
  { scenarioId: 'tier1_flamethrower_vs_shock_screen', unitType: 'flamethrower' },
  { scenarioId: 'tier1_jetpack_open_flank', unitType: 'jetpack_trooper' },
  { scenarioId: 'tier1_explosive_drone_vs_walker', unitType: 'explosive_drone' },
  { scenarioId: 'tier1_buggy_charge_flank', unitType: 'scavenger_buggy' },
]

describe('Tier 1 V9 characterization', () => {
  it('runs every Tier 1 scenario deterministically and terminates', () => {
    for (const scenario of TIER1_BALANCE_SCENARIOS) {
      const first = simulateV9(scenario)
      const second = simulateV9(scenario)

      expect(first.initialState, scenario.id).toEqual(second.initialState)
      expect(first.logs, scenario.id).toEqual(second.logs)
      expect(first.survivors, scenario.id).toEqual(second.survivors)
      expect(first.winner, scenario.id).toBe(second.winner)
      expect(first.terminationReason, scenario.id).toBe(second.terminationReason)
      expect(first.elapsedTicks, scenario.id).toBe(second.elapsedTicks)
      expectV9ResultContract(first, scenario.id)
    }
  }, 60000)

  it('keeps the production default on the certified V9 version and revision', () => {
    for (const scenarioId of REPRESENTATIVE_SCENARIOS) {
      const result = simulateProduction(findScenario(scenarioId))
      expect(result.simulationVersion, scenarioId).toBe(V9_SIMULATION_VERSION)
      expect(result.simulationRevision, scenarioId).toBe(V9_SIMULATION_REVISION)
    }
  }, 30000)

  it('keeps the explicit V8 comparison path available without asserting V8 outcomes', () => {
    const result = simulateV8(findScenario('tier1_marine_baseline_duel'))
    expect(result.simulationVersion).toBe(V8_SIMULATION_VERSION)
    expect(result.simulationRevision).toBe(V8_SIMULATION_REVISION)
  })

  it('matches production default to explicit V9 on representative scenarios', () => {
    for (const scenarioId of REPRESENTATIVE_SCENARIOS) {
      const scenario = findScenario(scenarioId)
      const explicitV9 = simulateV9(scenario)
      const production = simulateProduction(scenario)

      expect(production.winner, scenarioId).toBe(explicitV9.winner)
      expect(production.terminationReason, scenarioId).toBe(explicitV9.terminationReason)
      expect(production.elapsedTicks, scenarioId).toBe(explicitV9.elapsedTicks)
      expect(production.logs, scenarioId).toEqual(explicitV9.logs)
      expect(production.survivors, scenarioId).toEqual(explicitV9.survivors)
    }
  }, 30000)

  it('keeps high-signal role mechanics replay-visible under V9', () => {
    for (const gate of ROLE_SIGNAL_GATES) {
      const actions = flattenActions(simulateV9(findScenario(gate.scenarioId)))
      for (const actionType of gate.actionTypes) {
        expect(actions.map(action => action.type), gate.scenarioId).toContain(actionType)
      }
      if (gate.statusType) {
        expect(actions, gate.scenarioId).toContainEqual(expect.objectContaining({ type: 'status_apply', statusType: gate.statusType }))
      }
    }
  }, 30000)

  it('records non-zero activity for V9 role carriers under test', () => {
    for (const gate of ROLE_ACTIVITY_GATES) {
      const result = simulateV9(findScenario(gate.scenarioId))
      expect(result.metrics?.damageByUnitType[gate.unitType] ?? 0, gate.scenarioId).toBeGreaterThan(0)
    }

    const medic = simulateV9(findScenario('tier1_medic_sustain_check'))
    expect(medic.metrics?.healingDoneByUnitType.medic ?? 0, 'tier1_medic_sustain_check').toBeGreaterThan(0)
  }, 30000)
})

function simulateV8(scenario: CombatBalanceScenario): BattleResult {
  return simulateScenario(scenario, 'v8_sequential')
}

function simulateV9(scenario: CombatBalanceScenario): BattleResult {
  return simulateScenario(scenario, 'v9_snapshot')
}

function simulateProduction(scenario: CombatBalanceScenario): BattleResult {
  return simulateBattle(cloneRows(scenario.attackers), cloneRows(scenario.defenders), CHARACTERIZATION_SEED, [], [], [], { trackMetrics: true })
}

function simulateScenario(scenario: CombatBalanceScenario, defenseResolutionMode: 'v8_sequential' | 'v9_snapshot'): BattleResult {
  return simulateBattle(
    cloneRows(scenario.attackers),
    cloneRows(scenario.defenders),
    CHARACTERIZATION_SEED,
    [],
    [],
    [],
    { trackMetrics: true, defenseResolutionMode },
  )
}

function expectV9ResultContract(result: BattleResult, label: string): void {
  expect(result.logs.length, label).toBeGreaterThan(0)
  expect(result.logs.at(-1)?.tick ?? MAX_TICKS, label).toBeLessThan(MAX_TICKS)
  expect(result.elapsedTicks, label).toBeLessThan(MAX_TICKS)
  expect(new Set(result.initialState.map(unit => unit.id)).size, label).toBe(result.initialState.length)
  expect(new Set(result.survivors.map(unit => unit.id)).size, label).toBe(result.survivors.length)
  for (const unit of result.survivors) {
    expect(unit.isDead, `${label}: ${unit.id}`).toBe(false)
    expect(unit.hp, `${label}: ${unit.id}`).toBeGreaterThan(0)
    expect(unit.hp, `${label}: ${unit.id}`).toBeLessThanOrEqual(unit.maxHp)
  }
}

function findScenario(scenarioId: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(candidate => candidate.id === scenarioId)
  if (!scenario) throw new Error(`Missing Tier 1 scenario: ${scenarioId}`)
  return scenario
}

function flattenActions(result: BattleResult): BattleAction[] {
  return result.logs.flatMap(log => log.actions)
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
