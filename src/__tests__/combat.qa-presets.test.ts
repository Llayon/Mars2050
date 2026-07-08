import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '@/domains/combat/combat.types'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '@/app/simulator2/simulator.presets'

const REPLAY_GATE_PRESETS = ['ranged_duel', 'stealth_reveal', 'projectile_barrier', 'summon_caps', 'control_status', 'transform_modes'] as const

describe('combat QA simulator presets', () => {
  it('generates deterministic unit rows for every simulator preset', () => {
    for (const option of SIMULATOR_PRESET_OPTIONS) {
      expect(getSimulatorPreset(option.id), option.id).toEqual(getSimulatorPreset(option.id))
    }
  })

  it('produces deterministic replays for compact QA presets', () => {
    for (const presetId of REPLAY_GATE_PRESETS) {
      const first = simulatePreset(presetId)
      const second = simulatePreset(presetId)

      expect(second.initialState, presetId).toEqual(first.initialState)
      expect(second.logs, presetId).toEqual(first.logs)
      expect(second.survivors, presetId).toEqual(first.survivors)
      expect(first.logs.length, presetId).toBeGreaterThan(0)
      expect(first.logs.at(-1)?.tick ?? 0, presetId).toBeLessThan(MAX_TICKS)
    }
  }, 20000)

  it('keeps the 100+ runtime-unit stress preset inside QA metric bounds', () => {
    const result = simulatePreset('massive_clash', true)

    expect(result.initialState.length).toBeGreaterThanOrEqual(100)
    expect(result.metrics?.firstAttackTick).not.toBeNull()
    expect(result.metrics?.firstAttackTick ?? MAX_TICKS).toBeLessThanOrEqual(25)
    expect(result.metrics?.maxOverlap ?? 0).toBeLessThan(30)
    expect(result.metrics?.targetSwitches ?? 0).toBeLessThan(500)
  }, 15000)

  it('keeps summon-heavy QA presets bounded', () => {
    const result = simulatePreset('summon_caps')
    const spawnActions = result.logs.flatMap(log => log.actions).filter(action => action.type === 'spawn')

    expect(spawnActions.length).toBeGreaterThan(0)
    expect(spawnActions.length).toBeLessThanOrEqual(12)
    expect(result.logs.at(-1)?.tick ?? MAX_TICKS).toBeLessThan(MAX_TICKS)
  }, 15000)

  it('keeps primitive event replay QA preset action coverage stable', () => {
    const result = simulatePreset('qa_primitive_events')
    const actions = result.logs.flatMap(log => log.actions.map(action => action.type))

    expect(actions).toContain('control_convert')
    expect(actions).toContain('barrier_absorb')
    expect(actions).toContain('spawn_blocked')
    expect(actions).toContain('field_effect')
    expect(actions).toContain('hazard_cleanse')
    expect(actions).toContain('status_cleanse')
    expect(actions).toContain('projectile_intercept')
  }, 15000)
})

function simulatePreset(presetId: string, trackMetrics = false): BattleResult {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing preset: ${presetId}`)

  return simulateBattle(cloneRows(preset.attackers), cloneRows(preset.defenders), 24680, [], [], [], { trackMetrics })
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}
