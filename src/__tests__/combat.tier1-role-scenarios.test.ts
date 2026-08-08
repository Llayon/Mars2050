import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle as simulateBattleEngine } from '@/domains/combat/combat.engine'
import { getTier1CommandCost } from '@/domains/combat/combat.tier1.config'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { V9_SIMULATION_REVISION, V9_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'

function simulateProduction(...args: Parameters<typeof simulateBattleEngine>): ReturnType<typeof simulateBattleEngine> {
  const [attackers, defenders, seed, obstacles, attackerGlobals, defenderGlobals, options] = args
  expect(options?.defenseResolutionMode, 'authoritative Tier 1 certification must use the production default').toBeUndefined()
  const result = simulateBattleEngine(attackers, defenders, seed, obstacles, attackerGlobals, defenderGlobals, options)
  expect(result.simulationVersion, 'production simulation version').toBe(V9_SIMULATION_VERSION)
  expect(result.simulationRevision, 'production simulation revision').toBe(V9_SIMULATION_REVISION)
  return result
}

const SEED = 24680

const ROLE_SIGNAL_GATES: { scenarioId: string; actions: BattleActionType[]; statusType?: string }[] = [
  { scenarioId: 'tier1_heavy_gunner_sustained_line', actions: ['status_apply'], statusType: 'output_suppressed' },
  { scenarioId: 'tier1_flamethrower_vs_shock_screen', actions: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_jetpack_open_flank', actions: ['mode_change'] },
  { scenarioId: 'tier1_scout_focus_fire', actions: ['target_mark'] },
  { scenarioId: 'tier1_medic_sustain_check', actions: ['heal'] },
  { scenarioId: 'tier1_explosive_drone_vs_walker', actions: ['self_destruct', 'percent_hp_damage'] },
  { scenarioId: 'tier1_buggy_charge_flank', actions: ['charge_damage'] },
]

const DAMAGE_GATES: { scenarioId: string; unitType: string }[] = [
  { scenarioId: 'tier1_marine_baseline_duel', unitType: 'marine' },
  { scenarioId: 'tier1_heavy_gunner_sustained_line', unitType: 'heavy_gunner' },
  { scenarioId: 'tier1_grenadier_vs_clump', unitType: 'grenadier' },
  { scenarioId: 'tier1_grenadier_vs_spread', unitType: 'grenadier' },
  { scenarioId: 'tier1_flamethrower_vs_shock_screen', unitType: 'flamethrower' },
  { scenarioId: 'tier1_explosive_drone_vs_walker', unitType: 'explosive_drone' },
  { scenarioId: 'tier1_light_walker_anchors_aoe', unitType: 'light_walker' },
  { scenarioId: 'tier1_shock_screen_vs_snipers', unitType: 'shock_trooper' },
  { scenarioId: 'tier1_jetpack_open_flank', unitType: 'jetpack_trooper' },
  { scenarioId: 'tier1_sniper_priority_target', unitType: 'sniper' },
  { scenarioId: 'tier1_buggy_charge_flank', unitType: 'scavenger_buggy' },
]

describe('Tier 1 combat role scenarios', () => {
  it('defines a dedicated balance scenario for every Tier 1 role', () => {
    expect(TIER1_BALANCE_SCENARIOS.map(scenario => scenario.id)).toEqual([
      'tier1_marine_baseline_duel',
      'tier1_shock_screen_vs_snipers',
      'tier1_flamethrower_vs_shock_screen',
      'tier1_flamethrower_vs_ranged_line',
      'tier1_grenadier_vs_clump',
      'tier1_grenadier_vs_spread',
      'tier1_sniper_priority_target',
      'tier1_scout_focus_fire',
      'tier1_scout_countered_by_heavy',
      'tier1_medic_sustain_check',
      'tier1_light_walker_anchors_aoe',
      'tier1_light_walker_overwhelmed_by_line',
      'tier1_buggy_charge_flank',
      'tier1_explosive_drone_vs_walker',
      'tier1_explosive_drone_screened_out',
      'tier1_heavy_gunner_sustained_line',
      'tier1_heavy_gunner_exposed',
      'tier1_jetpack_open_flank',
      'tier1_jetpack_center_lane',
      'tier1_jetpack_vs_shock_screen',
    ])

    for (const scenario of TIER1_BALANCE_SCENARIOS) {
      const attackerPoints = scenario.attackers.reduce((total, unit) => total + (getTier1CommandCost(unit.unit_type) ?? 0), 0)
      const defenderPoints = scenario.defenders.reduce((total, unit) => total + (getTier1CommandCost(unit.unit_type) ?? 0), 0)
      expect(attackerPoints, scenario.id).toBeGreaterThan(0)
      expect(attackerPoints, scenario.id).toBe(defenderPoints)
      expect([...scenario.attackers, ...scenario.defenders].every(unit => getTier1CommandCost(unit.unit_type) === 1), scenario.id).toBe(true)
    }
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
  }, 60000)

  it('certifies the production default as the current V9 contract', () => {
    const result = simulateScenario(findScenario('tier1_marine_baseline_duel'))

    expect(result.simulationVersion).toBe(V9_SIMULATION_VERSION)
    expect(result.simulationRevision).toBe(V9_SIMULATION_REVISION)
  })

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

  it('keeps line-infantry overlap inside movement QA bounds', () => {
    const marineBaseline = simulateScenario(findScenario('tier1_marine_baseline_duel'))
    const heavyBaseline = simulateScenario(findScenario('tier1_heavy_gunner_exposed'))

    expect(marineBaseline.metrics?.averageOverlapRatio ?? 1, 'tier1_marine_baseline_duel').toBeLessThan(0.39)
    expect(marineBaseline.metrics?.severeOverlapSamples ?? Number.MAX_SAFE_INTEGER, 'tier1_marine_baseline_duel').toBeLessThan(1700)
    expect(heavyBaseline.metrics?.averageOverlapRatio ?? 1, 'tier1_heavy_gunner_exposed').toBeLessThan(0.38)
    expect(heavyBaseline.metrics?.severeOverlapSamples ?? Number.MAX_SAFE_INTEGER, 'tier1_heavy_gunner_exposed').toBeLessThan(1500)
  }, 30000)

  it('keeps sniper, grenadier, and buggy role contracts distinct', () => {
    const sniper = simulateScenario(findScenario('tier1_sniper_priority_target'))
    expect(sniper.metrics?.damageTakenByUnitType.medic ?? 0, 'tier1_sniper_priority_target').toBeGreaterThan(0)
    expect(sniper.survivors.some(unit => unit.team === 'defender' && unit.type === 'medic'), 'tier1_sniper_priority_target').toBe(false)

    const clump = simulateScenario(findScenario('tier1_grenadier_vs_clump'))
    const spread = simulateScenario(findScenario('tier1_grenadier_vs_spread'))
    expect(countDeathsByTick(clump, 30), 'tier1_grenadier_vs_clump').toBeGreaterThan(countDeathsByTick(spread, 30))

    const buggy = simulateScenario(findScenario('tier1_buggy_charge_flank'))
    expect(countActions(buggy, 'charge_damage'), 'tier1_buggy_charge_flank').toBeGreaterThanOrEqual(4)
    expect(buggy.metrics?.damageByUnitType.scavenger_buggy ?? 0, 'tier1_buggy_charge_flank').toBeGreaterThan(0)
    expect(buggy.winner, 'tier1_buggy_charge_flank').toBe('attacker')
  }, 30000)

  it('keeps the Tier 1 acceptance matrix from collapsing into generalists', () => {
    const heavy = simulateScenario(findScenario('tier1_heavy_gunner_sustained_line'))
    expect(countStatusApplications(heavy, 'output_suppressed'), 'tier1_heavy_gunner_sustained_line').toBeGreaterThan(0)
    expect(countActions(heavy, 'split_fire'), 'tier1_heavy_gunner_sustained_line').toBeGreaterThan(0)

    expect(simulateScenario(findScenario('tier1_shock_screen_vs_snipers')).winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_flamethrower_vs_shock_screen')).winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_flamethrower_vs_ranged_line')).winner).toBe('defender')
    expect(simulateScenario(findScenario('tier1_scout_focus_fire')).winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_scout_countered_by_heavy')).winner).toBe('defender')
    expect(simulateScenario(findScenario('tier1_light_walker_anchors_aoe')).winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_light_walker_overwhelmed_by_line')).winner).toBe('defender')
    expect(simulateScenario(findScenario('tier1_explosive_drone_vs_walker')).winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_explosive_drone_screened_out')).winner).toBe('defender')
    expect(heavy.winner).toBe('attacker')
    expect(simulateScenario(findScenario('tier1_heavy_gunner_exposed')).winner).toBe('defender')
    expect(simulateScenario(findScenario('tier1_jetpack_vs_shock_screen')).winner).toBe('defender')
  }, 30000)
})

function simulateScenario(scenario: CombatBalanceScenario): BattleResult {
  return simulateProduction(
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
