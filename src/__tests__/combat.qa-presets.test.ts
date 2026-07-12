import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import type { BattleActionType, BattleResult } from '@/domains/combat/combat.types'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '@/app/simulator2/simulator.presets'
import {
  countActions,
  expectBattleTerminates,
  expectDeterministicScenario,
  expectMetricBounds,
  expectReplayHas,
  expectSpawnBounded,
  flattenActions,
  simulateScenario,
} from './support/combat-scenario-gate'

const REPLAY_GATE_PRESETS = ['ranged_duel', 'stealth_reveal', 'projectile_barrier', 'summon_caps', 'control_status', 'transform_modes'] as const
const SCENARIO_ACTION_GATES: { presetId: string; requiredActions: BattleActionType[] }[] = [
  { presetId: 'projectile_barrier', requiredActions: ['projectile_intercept'] },
  { presetId: 'summon_caps', requiredActions: ['spawn'] },
  { presetId: 'transform_modes', requiredActions: ['mode_change', 'stance_change'] },
  { presetId: 'cleanse_status', requiredActions: ['status_cleanse'] },
]

describe('combat QA simulator presets', () => {
  it('generates deterministic unit rows for every simulator preset', () => {
    for (const option of SIMULATOR_PRESET_OPTIONS) {
      expect(getSimulatorPreset(option.id), option.id).toEqual(getSimulatorPreset(option.id))
    }
  })

  it('produces deterministic replays for compact QA presets', () => {
    for (const presetId of REPLAY_GATE_PRESETS) {
      expectDeterministicScenario(presetId)
    }
  }, 20000)

  it('keeps QA scenario mechanics replay-visible', () => {
    for (const gate of SCENARIO_ACTION_GATES) {
      const result = simulateScenario(gate.presetId)
      expectBattleTerminates(result, gate.presetId)
      expectReplayHas(result, gate.requiredActions, gate.presetId)
    }
  }, 20000)

  it('keeps stealth reveal observable through status replay actions', () => {
    const result = simulateScenario('stealth_reveal')
    expectBattleTerminates(result, 'stealth_reveal')
    expectStatusApplied(result, 'revealed', 'stealth_reveal')
  }, 15000)

  it('keeps zero-damage control support observable through status replay actions', () => {
    const result = simulateScenario('control_status')
    expectBattleTerminates(result, 'control_status')
    expectAppliedAnyStatus(result, ['emp', 'hacked'], 'control_status')
  }, 15000)

  it('keeps the 100+ runtime-unit stress preset inside QA metric bounds', () => {
    const result = simulateScenario('massive_clash', { trackMetrics: true })

    expect(result.initialState.length).toBeGreaterThanOrEqual(100)
    expectBattleTerminates(result, 'massive_clash')
    expectMetricBounds(result, {
      firstAttackTickMax: 25,
      maxOverlapLessThan: 30,
      maxOverlapRatioLessThan: 1,
      averageOverlapRatioLessThan: 0.34,
      severeOverlapSamplesLessThan: 2200,
      targetSwitchesLessThan: 500,
      battleDurationLessThan: MAX_TICKS,
      averageTimeToEngageMax: 40,
    }, 'massive_clash')
  }, 15000)

  it('keeps ranged-line overlap inside QA metric bounds', () => {
    const result = simulateScenario('ranged_duel', { trackMetrics: true })

    expectBattleTerminates(result, 'ranged_duel')
    expectMetricBounds(result, {
      maxOverlapRatioLessThan: 1,
      averageOverlapRatioLessThan: 0.36,
      severeOverlapSamplesLessThan: 8000,
      battleDurationLessThan: MAX_TICKS,
    }, 'ranged_duel')
  }, 15000)

  it('keeps summon-heavy QA presets bounded', () => {
    const summonCaps = simulateScenario('summon_caps')
    const primitiveEvents = simulateScenario('qa_primitive_events')

    expectBattleTerminates(summonCaps, 'summon_caps')
    expectSpawnBounded(summonCaps, 12, 'summon_caps')
    expectBattleTerminates(primitiveEvents, 'qa_primitive_events')
    expectSpawnBounded(primitiveEvents, 12, 'qa_primitive_events')
    expect(countActions(primitiveEvents, 'spawn_blocked'), 'qa_primitive_events').toBeGreaterThan(0)
  }, 15000)

  it('keeps primitive event replay QA preset action coverage stable', () => {
    const result = simulateScenario('qa_primitive_events')

    expectBattleTerminates(result, 'qa_primitive_events')
    expectReplayHas(result, [
      'control_convert',
      'barrier_absorb',
      'spawn_blocked',
      'field_effect',
      'hazard_cleanse',
      'status_cleanse',
      'projectile_intercept',
    ], 'qa_primitive_events')
  }, 15000)
})

function expectStatusApplied(result: BattleResult, statusType: string, label: string): void {
  expect(flattenActions(result), label).toContainEqual(expect.objectContaining({ type: 'status_apply', statusType }))
}

function expectAppliedAnyStatus(result: BattleResult, statusTypes: string[], label: string): void {
  const appliedStatuses = flattenActions(result)
    .filter(action => action.type === 'status_apply')
    .map(action => action.statusType)

  expect(appliedStatuses.some(statusType => statusType !== undefined && statusTypes.includes(statusType)), label).toBe(true)
}
