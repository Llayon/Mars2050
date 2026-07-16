import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { P0_ROLE_SCENARIOS, type CombatP0RoleScenario } from '@/domains/combat/combat.p0-role-scenarios'
import type { BattleAction, BattleActionType, BattleResult, UnitRow } from '@/domains/combat/combat.types'

const SEED = 24680

const ROLE_SCENARIOS = [
  'p0_emp_drone_control_window',
  'p0_hacker_redirect_window',
  'p0_radar_reveal_range_relay',
  'p0_officer_haste_formation',
  'p0_shield_emitter_projectile_guard',
  'p0_hologram_decoy_pressure',
]

describe('P0 combat role scenarios', () => {
  it('defines role and baseline scenarios for every P0 partial unit', () => {
    expect(P0_ROLE_SCENARIOS.map(scenario => scenario.id)).toEqual([
      'p0_emp_drone_control_window',
      'p0_emp_drone_baseline',
      'p0_hacker_redirect_window',
      'p0_hacker_baseline',
      'p0_radar_reveal_range_relay',
      'p0_radar_baseline',
      'p0_officer_haste_formation',
      'p0_officer_baseline',
      'p0_shield_emitter_projectile_guard',
      'p0_shield_baseline',
      'p0_hologram_decoy_pressure',
      'p0_hologram_baseline',
    ])
  })

  it('keeps every P0 role scenario deterministic and terminating', () => {
    for (const scenario of P0_ROLE_SCENARIOS) {
      const first = simulateScenario(scenario)
      const second = simulateScenario(scenario)

      expect(first.initialState, scenario.id).toEqual(second.initialState)
      expect(first.logs, scenario.id).toEqual(second.logs)
      expect(first.survivors, scenario.id).toEqual(second.survivors)
      expect(first.logs.length, scenario.id).toBeGreaterThan(0)
      expect(first.logs.at(-1)?.tick ?? MAX_TICKS, scenario.id).toBeLessThan(MAX_TICKS)
    }
  }, 30000)

  it('keeps P0 role signals replay-visible', () => {
    const expectedSignals: Record<string, { action: BattleActionType; statusType?: string }> = {
      p0_emp_drone_control_window: { action: 'status_apply', statusType: 'emp' },
      p0_hacker_redirect_window: { action: 'status_apply', statusType: 'hacked' },
      p0_radar_reveal_range_relay: { action: 'status_apply', statusType: 'revealed' },
      p0_officer_haste_formation: { action: 'status_apply', statusType: 'haste' },
      p0_shield_emitter_projectile_guard: { action: 'projectile_intercept' },
      p0_hologram_decoy_pressure: { action: 'spawn' },
    }

    for (const scenarioId of ROLE_SCENARIOS) {
      const result = simulateScenario(findScenario(scenarioId))
      const actions = flattenActions(result)
      const expected = expectedSignals[scenarioId]

      expect(actions.map(action => action.type), scenarioId).toContain(expected.action)
      if (expected.statusType) {
        expect(actions, scenarioId).toContainEqual(expect.objectContaining({ type: 'status_apply', statusType: expected.statusType }))
      }
    }
  }, 30000)

  it('keeps zero-damage control supports useful without direct damage', () => {
    const emp = simulateScenario(findScenario('p0_emp_drone_control_window'))
    const empBaseline = simulateScenario(findScenario('p0_emp_drone_baseline'))
    expect(countStatusApplications(emp, 'emp'), 'p0_emp_drone_control_window').toBeGreaterThan(0)
    expect(emp.metrics?.damageTakenByUnitType.emp_drone ?? 0, 'p0_emp_drone_control_window').toBeGreaterThan(0)
    expect(emp.metrics?.damageByUnitType.emp_drone ?? 0, 'EMP drone should stay zero-damage utility').toBe(0)
    expect(emp.logs.length, 'EMP control window should change the engagement, not be a no-op')
      .not.toBe(empBaseline.logs.length)

    const hacker = simulateScenario(findScenario('p0_hacker_redirect_window'))
    const hackerBaseline = simulateScenario(findScenario('p0_hacker_baseline'))
    expect(countStatusApplications(hacker, 'hacked'), 'p0_hacker_redirect_window').toBeGreaterThan(0)
    expect(hacker.metrics?.damageByUnitType.hacker_rover ?? 0, 'hacker should stay zero-damage utility').toBe(0)
    expect(hacker.logs.length, 'hacker redirect window should change the engagement, not be a no-op')
      .not.toBe(hackerBaseline.logs.length)
  }, 30000)

  it('keeps radar and officer utility value measurable against baselines', () => {
    const radar = simulateScenario(findScenario('p0_radar_reveal_range_relay'))
    const radarBaseline = simulateScenario(findScenario('p0_radar_baseline'))
    expect(countStatusApplications(radar, 'revealed'), 'p0_radar_reveal_range_relay').toBeGreaterThan(0)
    expect(countStatusApplications(radar, 'range_boost'), 'p0_radar_reveal_range_relay').toBeGreaterThan(0)
    expect(radar.metrics?.damageByUnitType.radar_zepplin ?? 0, 'radar should stay zero-damage utility').toBe(0)
    expect(radar.logs.length, 'radar reveal/relay should change the engagement, not be a no-op')
      .not.toBe(radarBaseline.logs.length)

    const officer = simulateScenario(findScenario('p0_officer_haste_formation'))
    const officerBaseline = simulateScenario(findScenario('p0_officer_baseline'))
    expect(countStatusApplications(officer, 'haste'), 'p0_officer_haste_formation').toBeGreaterThan(0)
    expect(officer.metrics?.battleDurationTicks ?? MAX_TICKS, 'officer should improve formation tempo')
      .toBeLessThan(officerBaseline.metrics?.battleDurationTicks ?? MAX_TICKS)
  }, 30000)

  it('keeps shield emitter and hologram bounded protection roles measurable', () => {
    const shield = simulateScenario(findScenario('p0_shield_emitter_projectile_guard'))
    const shieldBaseline = simulateScenario(findScenario('p0_shield_baseline'))
    expect(countActions(shield, 'projectile_intercept'), 'p0_shield_emitter_projectile_guard').toBeGreaterThan(0)
    expect(countActions(shield, 'shield_apply'), 'p0_shield_emitter_projectile_guard').toBeGreaterThan(0)
    expect(shield.metrics?.damageTakenByUnitType.marine ?? 0, 'shield should reduce protected marine damage')
      .toBeLessThan(shieldBaseline.metrics?.damageTakenByUnitType.marine ?? 0)

    const hologram = simulateScenario(findScenario('p0_hologram_decoy_pressure'))
    const hologramBaseline = simulateScenario(findScenario('p0_hologram_baseline'))
    expect(countActions(hologram, 'spawn'), 'p0_hologram_decoy_pressure').toBeGreaterThan(0)
    expect(peakActiveSummons(hologram), 'p0_hologram_decoy_pressure').toBeLessThanOrEqual(2)
    expect(hologram.metrics?.damageTakenByUnitType.marine ?? 0, 'hologram should draw fire away from real marines')
      .toBeLessThan(hologramBaseline.metrics?.damageTakenByUnitType.marine ?? 0)
  }, 30000)
})

function simulateScenario(scenario: CombatP0RoleScenario): BattleResult {
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

function findScenario(scenarioId: string): CombatP0RoleScenario {
  const scenario = P0_ROLE_SCENARIOS.find(candidate => candidate.id === scenarioId)
  if (!scenario) throw new Error(`Missing P0 scenario: ${scenarioId}`)
  return scenario
}

function flattenActions(result: BattleResult): BattleAction[] {
  return result.logs.flatMap(log => log.actions)
}

function countActions(result: BattleResult, type: BattleActionType): number {
  return flattenActions(result).filter(action => action.type === type).length
}

function peakActiveSummons(result: BattleResult): number {
  const active = new Set<string>()
  let peak = 0
  for (const action of flattenActions(result)) {
    if (action.type === 'spawn' && action.targetId) active.add(action.targetId)
    if (action.type === 'die') active.delete(action.unitId)
    peak = Math.max(peak, active.size)
  }
  return peak
}

function countStatusApplications(result: BattleResult, statusType: string): number {
  return flattenActions(result).filter(action => action.type === 'status_apply' && action.statusType === statusType).length
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
