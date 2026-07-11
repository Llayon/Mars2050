import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'

const SEED = 24680

const ROLE_SIGNAL_GATES: { scenarioId: string; actions: BattleActionType[]; statusType?: string }[] = [
  { scenarioId: 'tier1_heavy_gunner_sustained_line', actions: ['status_apply'], statusType: 'output_suppressed' },
  { scenarioId: 'tier1_flamethrower_vs_swarm', actions: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_flamethrower_vs_armored_screen', actions: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_jetpack_backline_access', actions: ['mode_change'] },
  { scenarioId: 'tier1_medic_sustain_check', actions: ['heal'] },
  { scenarioId: 'tier1_officer_aura_check', actions: ['status_apply'], statusType: 'haste' },
  { scenarioId: 'tier1_buggy_charge_flank', actions: ['charge_damage'] },
  { scenarioId: 'tier1_buggy_open_flank', actions: ['charge_damage'] },
]

const DAMAGE_GATES: { scenarioId: string; unitType: string }[] = [
  { scenarioId: 'tier1_marine_baseline_duel', unitType: 'marine' },
  { scenarioId: 'tier1_heavy_gunner_sustained_line', unitType: 'heavy_gunner' },
  { scenarioId: 'tier1_grenadier_vs_clump', unitType: 'grenadier' },
  { scenarioId: 'tier1_grenadier_vs_spread', unitType: 'grenadier' },
  { scenarioId: 'tier1_flamethrower_vs_swarm', unitType: 'flamethrower' },
  { scenarioId: 'tier1_sapper_vs_static_guard', unitType: 'sapper' },
  { scenarioId: 'tier1_shock_trooper_vs_rifle_line', unitType: 'shock_trooper' },
  { scenarioId: 'tier1_jetpack_backline_access', unitType: 'jetpack_trooper' },
  { scenarioId: 'tier1_sniper_priority_target', unitType: 'sniper' },
  { scenarioId: 'tier1_scout_drone_aa_check', unitType: 'scout_drone' },
  { scenarioId: 'tier1_buggy_charge_flank', unitType: 'scavenger_buggy' },
  { scenarioId: 'tier1_buggy_open_flank', unitType: 'scavenger_buggy' },
]

const DIAGNOSTIC_MATCHUP_SCENARIOS = [
  'tier1_heavy_gunner_vs_marine_line',
  'tier1_shock_trooper_vs_grenadier_screen',
  'tier1_sapper_vs_mobile_screen',
  'tier1_jetpack_vs_aa_screen',
]

describe('Tier 1 combat role scenarios', () => {
  it('defines a dedicated balance scenario for every Tier 1 role', () => {
    expect(TIER1_BALANCE_SCENARIOS.map(scenario => scenario.id)).toEqual([
      'tier1_marine_baseline_duel',
      'tier1_heavy_gunner_sustained_line',
      'tier1_grenadier_vs_clump',
      'tier1_grenadier_vs_spread',
      'tier1_flamethrower_vs_swarm',
      'tier1_flamethrower_vs_armored_screen',
      'tier1_sapper_vs_static_guard',
      'tier1_shock_trooper_vs_rifle_line',
      'tier1_jetpack_backline_access',
      'tier1_sniper_priority_target',
      'tier1_scout_drone_aa_check',
      'tier1_medic_sustain_check',
      'tier1_officer_aura_check',
      'tier1_buggy_charge_flank',
      'tier1_buggy_open_flank',
      'tier1_heavy_gunner_vs_marine_line',
      'tier1_shock_trooper_vs_grenadier_screen',
      'tier1_sapper_vs_mobile_screen',
      'tier1_jetpack_vs_aa_screen',
    ])
  })

  it('keeps every Tier 1 role scenario deterministic and terminating', () => {
    for (const scenario of TIER1_BALANCE_SCENARIOS) {
      const first = simulateScenario(scenario)
      const second = simulateScenario(scenario)

      expect(first.initialState, scenario.id).toEqual(second.initialState)
      expect(first.logs, scenario.id).toEqual(second.logs)
      expect(first.survivors, scenario.id).toEqual(second.survivors)
      expect(first.logs.length, scenario.id).toBeGreaterThan(0)
      expect(first.logs.at(-1)?.tick ?? MAX_TICKS, scenario.id).toBeLessThan(MAX_TICKS)
    }
  }, 30000)

  it('keeps high-signal Tier 1 mechanics replay-visible', () => {
    for (const gate of ROLE_SIGNAL_GATES) {
      const result = simulateScenario(findScenario(gate.scenarioId))
      const actions = flattenActions(result)

      for (const actionType of gate.actions) {
        expect(actions.map(action => action.type), gate.scenarioId).toContain(actionType)
      }
      if (gate.statusType) {
        expect(actions, gate.scenarioId).toContainEqual(expect.objectContaining({ type: 'status_apply', statusType: gate.statusType }))
      }
    }
  }, 30000)

  it('records non-zero damage or healing for the role carrier under test', () => {
    for (const gate of DAMAGE_GATES) {
      const result = simulateScenario(findScenario(gate.scenarioId))
      expect(result.metrics?.damageByUnitType[gate.unitType] ?? 0, gate.scenarioId).toBeGreaterThan(0)
    }

    const medic = simulateScenario(findScenario('tier1_medic_sustain_check'))
    expect(medic.metrics?.healingDoneByUnitType.medic ?? 0, 'tier1_medic_sustain_check').toBeGreaterThan(0)
  }, 30000)

  it('keeps sniper, grenadier, and buggy role contracts distinct', () => {
    const sniper = simulateScenario(findScenario('tier1_sniper_priority_target'))
    expect(sniper.metrics?.damageTakenByUnitType.medic ?? 0, 'tier1_sniper_priority_target').toBeGreaterThanOrEqual(150)
    expect(sniper.survivors.some(unit => unit.team === 'defender' && unit.type === 'medic'), 'tier1_sniper_priority_target').toBe(false)

    const clump = simulateScenario(findScenario('tier1_grenadier_vs_clump'))
    const spread = simulateScenario(findScenario('tier1_grenadier_vs_spread'))
    expect(countDeathsByTick(clump, 20), 'tier1_grenadier_vs_clump').toBeGreaterThan(countDeathsByTick(spread, 20) + 10)

    const buggy = simulateScenario(findScenario('tier1_buggy_open_flank'))
    expect(countActions(buggy, 'charge_damage'), 'tier1_buggy_open_flank').toBeGreaterThanOrEqual(4)
    expect(buggy.metrics?.damageByUnitType.scavenger_buggy ?? 0, 'tier1_buggy_open_flank')
      .toBeGreaterThan(buggy.metrics?.damageTakenByUnitType.scavenger_buggy ?? 0)
  }, 30000)

  it('keeps the Tier 1 acceptance matrix from collapsing into generalists', () => {
    const heavy = simulateScenario(findScenario('tier1_heavy_gunner_sustained_line'))
    expect(countStatusApplications(heavy, 'output_suppressed'), 'tier1_heavy_gunner_sustained_line').toBeGreaterThanOrEqual(50)

    const flameSwarm = simulateScenario(findScenario('tier1_flamethrower_vs_swarm'))
    const flameArmor = simulateScenario(findScenario('tier1_flamethrower_vs_armored_screen'))
    expect(flameSwarm.winner, 'tier1_flamethrower_vs_swarm').toBe('attacker')
    expect(flameArmor.winner, 'tier1_flamethrower_vs_armored_screen').toBe('defender')

    const sapper = simulateScenario(findScenario('tier1_sapper_vs_static_guard'))
    expect(sapper.winner, 'tier1_sapper_vs_static_guard').toBe('attacker')
    expect(sapper.survivors.some(unit => unit.team === 'defender' && unit.type === 'wall'), 'tier1_sapper_vs_static_guard').toBe(false)
    expect(sapper.metrics?.damageTakenByUnitType.wall ?? 0, 'tier1_sapper_vs_static_guard').toBeGreaterThanOrEqual(400)

    const aa = simulateScenario(findScenario('tier1_scout_drone_aa_check'))
    expect(aa.winner, 'tier1_scout_drone_aa_check').toBe('defender')
    expect(aa.survivors.some(unit => unit.team === 'defender' && unit.type === 'aa_turret'), 'tier1_scout_drone_aa_check').toBe(true)
    expect(aa.survivors.some(unit => unit.team === 'attacker' && unit.type === 'scout_drone'), 'tier1_scout_drone_aa_check').toBe(false)

    const shock = simulateScenario(findScenario('tier1_shock_trooper_vs_rifle_line'))
    expect(shock.winner, 'tier1_shock_trooper_vs_rifle_line').toBe('defender')
  }, 30000)

  it('keeps Tier 1 cross-matchup diagnostics visible without hard winner gates', () => {
    for (const scenarioId of DIAGNOSTIC_MATCHUP_SCENARIOS) {
      const result = simulateScenario(findScenario(scenarioId))
      expect(result.logs.length, scenarioId).toBeGreaterThan(0)
      expect(result.logs.at(-1)?.tick ?? MAX_TICKS, scenarioId).toBeLessThan(MAX_TICKS)
      expect(result.metrics?.battleDurationTicks ?? 0, scenarioId).toBeGreaterThan(0)
    }

    const heavy = simulateScenario(findScenario('tier1_heavy_gunner_vs_marine_line'))
    expect(heavy.metrics?.damageByUnitType.heavy_gunner ?? 0, 'tier1_heavy_gunner_vs_marine_line').toBeGreaterThan(0)
    expect(countStatusApplications(heavy, 'output_suppressed'), 'tier1_heavy_gunner_vs_marine_line').toBeGreaterThan(0)

    const shock = simulateScenario(findScenario('tier1_shock_trooper_vs_grenadier_screen'))
    expect(shock.metrics?.damageByUnitType.shock_trooper ?? 0, 'tier1_shock_trooper_vs_grenadier_screen').toBeGreaterThan(0)
    expect(shock.metrics?.damageByUnitType.grenadier ?? 0, 'tier1_shock_trooper_vs_grenadier_screen').toBeGreaterThan(0)

    const sapper = simulateScenario(findScenario('tier1_sapper_vs_mobile_screen'))
    expect(sapper.metrics?.damageByUnitType.sapper ?? 0, 'tier1_sapper_vs_mobile_screen').toBeGreaterThan(0)

    const jetpack = simulateScenario(findScenario('tier1_jetpack_vs_aa_screen'))
    expect(countActions(jetpack, 'mode_change'), 'tier1_jetpack_vs_aa_screen').toBeGreaterThan(0)
    expect(jetpack.metrics?.damageByUnitType.aa_turret ?? 0, 'tier1_jetpack_vs_aa_screen').toBeGreaterThan(0)
  }, 30000)
})

function simulateScenario(scenario: CombatBalanceScenario): BattleResult {
  return simulateBattle(
    cloneRows(scenario.attackers),
    cloneRows(scenario.defenders),
    SEED,
    [],
    [],
    [],
    { trackMetrics: true }
  )
}

function findScenario(scenarioId: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(candidate => candidate.id === scenarioId)
  if (!scenario) throw new Error(`Missing Tier 1 scenario: ${scenarioId}`)
  return scenario
}

function flattenActions(result: BattleResult): BattleAction[] {
  return result.logs.flatMap(log => log.actions)
}

function countActions(result: BattleResult, type: BattleActionType): number {
  return flattenActions(result).filter(action => action.type === type).length
}

function countDeathsByTick(result: BattleResult, maxTick: number): number {
  return result.logs
    .filter(log => log.tick <= maxTick)
    .flatMap(log => log.actions)
    .filter(action => action.type === 'die')
    .length
}

function countStatusApplications(result: BattleResult, statusType: string): number {
  return flattenActions(result).filter(action => action.type === 'status_apply' && action.statusType === statusType).length
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
