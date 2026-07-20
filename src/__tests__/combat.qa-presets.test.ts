import { describe, expect, it } from 'vitest'
import type { BattleActionType, BattleResult } from '@/domains/combat/combat.types'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '@/app/simulator2/simulator.presets'
import {
  countActions,
  expectBattleTerminates,
  expectDeterministicScenario,
  expectMetricBounds,
  expectReplayMetricsAligned,
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
const MOVEMENT_QA_GATES = [
  {
    presetId: 'ranged_duel',
    bounds: {
      firstAttackTickMax: 18,
      maxOverlapLessThan: 21,
      averageOverlapRatioLessThan: 0.24,
      severeOverlapSamplesLessThan: 1600,
      targetSwitchesLessThan: 2200,
      battleDurationLessThan: 165,
      averageTimeToEngageMax: 26,
      totalStuckTicksLessThan: 100,
      meleeSlotWaitTicksLessThan: 1,
    },
  },
  {
    presetId: 'massive_clash',
    bounds: {
      minInitialUnits: 100,
      firstAttackTickMax: 25,
      maxOverlapLessThan: 30,
      averageOverlapRatioLessThan: 0.24,
      severeOverlapSamplesLessThan: 900,
      targetSwitchesLessThan: 500,
      battleDurationLessThan: 110,
      averageTimeToEngageMax: 40,
      totalStuckTicksLessThan: 1500,
      meleeSlotWaitTicksLessThan: 3500,
    },
  },
  {
    presetId: 'zerg_rush',
    bounds: {
      minInitialUnits: 500,
      firstAttackTickMax: 12,
      maxOverlapLessThan: 38,
      averageOverlapRatioLessThan: 0.29,
      severeOverlapSamplesLessThan: 32000,
      targetSwitchesLessThan: 6500,
      battleDurationLessThan: 175,
      averageTimeToEngageMax: 42,
      totalStuckTicksLessThan: 8500,
      meleeSlotWaitTicksLessThan: 25000,
    },
  },
] as const

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
  }, 30000)

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

  for (const gate of MOVEMENT_QA_GATES) {
    it(`keeps ${gate.presetId} movement metrics inside QA bounds`, () => {
      const result = simulateScenario(gate.presetId, { trackMetrics: true, profile: true })

      expectBattleTerminates(result, gate.presetId)
      expectMetricBounds(result, gate.bounds, gate.presetId)
      expectReplayMetricsAligned(result, gate.presetId)
      const baselineCandidates = ({
        massive_clash: 1_490_721,
        zerg_rush: 75_830_013,
      } as Record<string, number>)[gate.presetId]
      if (baselineCandidates !== undefined) {
        const currentCandidates = (result.profile?.componentCandidateCount ?? Infinity) +
          (result.profile?.bucketCandidateCount ?? Infinity)
        expect(currentCandidates, `${gate.presetId}: ECS candidate reduction`)
          .toBeLessThanOrEqual(baselineCandidates * 0.3)
      }
    }, gate.presetId === 'zerg_rush' ? 150000 : 30000)
  }

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
