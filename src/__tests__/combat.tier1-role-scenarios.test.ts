import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'

const SEED = 24680

const ROLE_SIGNAL_GATES: { scenarioId: string; actions: BattleActionType[]; statusType?: string }[] = [
  { scenarioId: 'tier1_flamethrower_vs_swarm', actions: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_flamethrower_vs_armored_screen', actions: ['cone_attack'], statusType: 'burn' },
  { scenarioId: 'tier1_jetpack_backline_access', actions: ['mode_change'] },
  { scenarioId: 'tier1_medic_sustain_check', actions: ['heal'] },
  { scenarioId: 'tier1_officer_aura_check', actions: ['status_apply'], statusType: 'haste' },
  { scenarioId: 'tier1_buggy_charge_flank', actions: ['charge_damage'] },
]

const DAMAGE_GATES: { scenarioId: string; unitType: string }[] = [
  { scenarioId: 'tier1_marine_baseline_duel', unitType: 'marine' },
  { scenarioId: 'tier1_heavy_gunner_sustained_line', unitType: 'heavy_gunner' },
  { scenarioId: 'tier1_grenadier_vs_clump', unitType: 'grenadier' },
  { scenarioId: 'tier1_flamethrower_vs_swarm', unitType: 'flamethrower' },
  { scenarioId: 'tier1_sapper_vs_static_guard', unitType: 'sapper' },
  { scenarioId: 'tier1_shock_trooper_vs_rifle_line', unitType: 'shock_trooper' },
  { scenarioId: 'tier1_jetpack_backline_access', unitType: 'jetpack_trooper' },
  { scenarioId: 'tier1_sniper_priority_target', unitType: 'sniper' },
  { scenarioId: 'tier1_scout_drone_aa_check', unitType: 'scout_drone' },
  { scenarioId: 'tier1_buggy_charge_flank', unitType: 'scavenger_buggy' },
]

describe('Tier 1 combat role scenarios', () => {
  it('defines a dedicated balance scenario for every Tier 1 role', () => {
    expect(TIER1_BALANCE_SCENARIOS.map(scenario => scenario.id)).toEqual([
      'tier1_marine_baseline_duel',
      'tier1_heavy_gunner_sustained_line',
      'tier1_grenadier_vs_clump',
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

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
