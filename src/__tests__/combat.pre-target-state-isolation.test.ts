import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { getEcsPhaseOrder } from '@/domains/combat/ecs/combat-phase-scheduler'
import { captureMovementPipelineCell } from './helpers/combat-movement-pipeline-probes'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import {
  captureSemanticStateSnapshot,
  canonicalSerialize,
  compareSemanticStates,
} from './helpers/combat-semantic-state-diff'
import {
  scanPreTargetPhaseBoundaries,
} from './helpers/combat-phase-boundary-probes'
import { validateSchedulerEquivalence } from './helpers/combat-phase-scheduler-equivalence'

describe('combat pre-target state isolation', () => {
  it('matches production stage execution independently for baseline and candidate', () => {
    const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
    for (const transform of ['baseline', 'defender_cohort_rank_reassigned'] as const) {
      const probe = applyOrderingProbe(scenario, transform)
      const result = validateSchedulerEquivalence(scenario, 101, probe)
      expect(result.equivalent, transform).toBe(true)
      expect(result.productionState.clock.tick).toBe(0)
      expect(result.manualState.clock.tick).toBe(0)
      expect(result.productionActions).toEqual(result.manualActions)
      expect(result.productionTerminal).toEqual(result.manualTerminal)
    }
  })

  it('uses the production boundary sequence without inter-phase terminal checks', () => {
    const result = scanPrimary()
    const expectedLabels = [
      'tick0.initial',
      ...getEcsPhaseOrder('pre_action').map(phase => `tick0.pre_action.after.${phase}`),
      'tick0.before_actor_turn',
      'tick0.action.after.actor_turn',
      ...getEcsPhaseOrder('post_action').map(phase => `tick0.post_action.after.${phase}`),
      'tick1.initial',
      ...getEcsPhaseOrder('pre_action').map(phase => `tick1.pre_action.after.${phase}`),
      'tick1.before_actor_turn',
      'tick1.action.after.actor_turn',
    ]
    expect(result.boundaries.map(boundary => boundary.label)).toEqual(expectedLabels)
    expect(result.boundaries.filter(boundary => boundary.terminalCheck).map(boundary => boundary.label)).toEqual([
      'tick0.before_actor_turn',
      'tick1.before_actor_turn',
    ])
  })

  it('keeps the initial semantic state and entity mapping stable', () => {
    const result = scanPrimary()
    expect(result.initialMappingEquivalent).toBe(true)
    expect(result.boundaries[0]?.equivalentToCandidate).toBe(true)
  })

  it('finds one deterministic first transition and continues to the endpoint', () => {
    const first = scanPrimary()
    const second = scanPrimary()
    expect(canonicalSerialize(first)).toBe(canonicalSerialize(second))
    expect(first.classification).toBe('PHASE_BOUNDARY_LOCALIZED')
    expect(first.firstDivergentBoundary?.previous?.label).toBeDefined()
    expect(first.firstDivergentBoundary?.current.label).toBeDefined()
    expect(first.firstDivergentBoundary?.current.ordinal).toBeGreaterThan(
      first.firstDivergentBoundary?.previous?.ordinal ?? -1,
    )
  })

  it('reproduces the merged PR #11 target-tick Stage 0 projection', () => {
    const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
    const baselineProbe = applyOrderingProbe(scenario, 'baseline')
    const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const scan = scanPreTargetPhaseBoundaries(scenario, 101, baselineProbe, candidateProbe)
    const baselineStage0 = captureMovementPipelineCell(scenario, 101, 'BB', baselineProbe, 1).stage0
    const candidateStage0 = captureMovementPipelineCell(scenario, 101, 'CC', candidateProbe, 1).stage0
    expect(scan.baselineEndpoint).not.toBeNull()
    expect(scan.candidateEndpoint).not.toBeNull()
    expect(compareSemanticStates(scan.baselineEndpoint!, baselineStage0).equivalent).toBe(true)
    expect(compareSemanticStates(scan.candidateEndpoint!, candidateStage0).equivalent).toBe(true)
    expect(compareSemanticStates(scan.baselineEndpoint!, scan.candidateEndpoint!).equivalent).toBe(false)
  })

  it('captures semantic snapshots without mutating the world', () => {
    const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
    const probe = applyOrderingProbe(scenario, 'baseline')
    const runtime = validateSchedulerEquivalence(scenario, 101, probe)
    const before = captureSemanticStateSnapshot(runtime.manualStateRuntime, probe)
    const beforeResources = JSON.stringify({
      clock: runtime.manualStateRuntime.world.resources.require('clock'),
      actions: runtime.manualStateRuntime.world.resources.require('actions'),
      followUps: runtime.manualStateRuntime.world.resources.require('v9FollowUps'),
    })
    const after = captureSemanticStateSnapshot(runtime.manualStateRuntime, probe)
    const afterResources = JSON.stringify({
      clock: runtime.manualStateRuntime.world.resources.require('clock'),
      actions: runtime.manualStateRuntime.world.resources.require('actions'),
      followUps: runtime.manualStateRuntime.world.resources.require('v9FollowUps'),
    })
    expect(canonicalSerialize(before)).toBe(canonicalSerialize(after))
    expect(afterResources).toBe(beforeResources)
  })

  it('reproduces the seed-101 transition across all certified seeds', () => {
    const primary = scanPrimary()
    const previousOrdinal = primary.firstDivergentBoundary?.previous?.ordinal
    const currentOrdinal = primary.firstDivergentBoundary?.current.ordinal
    expect(previousOrdinal).toBeDefined()
    expect(currentOrdinal).toBeDefined()
    for (const seed of [101, 202, 303, 404, 505]) {
      const result = scanPreTargetPhaseBoundaries(
        scenarioById('tier1_heavy_gunner_sustained_line'),
        seed,
        applyOrderingProbe(scenarioById('tier1_heavy_gunner_sustained_line'), 'baseline'),
        applyOrderingProbe(scenarioById('tier1_heavy_gunner_sustained_line'), 'defender_cohort_rank_reassigned'),
      )
      expect(result.boundaries[previousOrdinal!]?.equivalentToCandidate).toBe(true)
      expect(result.boundaries[currentOrdinal!]?.equivalentToCandidate).toBe(false)
      expect(result.firstDivergentBoundary?.current.ordinal).toBe(currentOrdinal)
    }
  })

  it('keeps Heavy exposed and Marine controls equivalent at the Heavy boundary', () => {
    const primary = scanPrimary()
    const previousOrdinal = primary.firstDivergentBoundary?.previous?.ordinal
    const currentOrdinal = primary.firstDivergentBoundary?.current.ordinal
    for (const scenarioId of ['tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel'] as const) {
      const scenario = scenarioById(scenarioId)
      const result = scanPreTargetPhaseBoundaries(
        scenario,
        101,
        applyOrderingProbe(scenario, 'baseline'),
        applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned'),
      )
      expect(result.boundaries[previousOrdinal!]?.equivalentToCandidate).toBe(true)
      expect(result.boundaries[currentOrdinal!]?.equivalentToCandidate).toBe(true)
      expect(result.firstDivergentBoundary).toBeNull()
    }
  })

  it('reports the first transition as a deterministic semantic field change', () => {
    const first = scanPrimary().firstDivergentBoundary
    expect(first?.current.label).toBe('tick1.action.after.actor_turn')
    expect(first?.firstSemanticStateDivergence).toEqual({
      semanticActor: 'defender:t1-heavy-shock-d-0:6',
      component: 'entityTargets',
      fieldPath: 'meleeTarget',
      baselineValue: 'attacker:t1-heavy-screen-a-0:2',
      candidateValue: 'attacker:t1-heavy-screen-a-0:1',
    })
  })
})

function scanPrimary() {
  const scenario = scenarioById('tier1_heavy_gunner_sustained_line')
  return scanPreTargetPhaseBoundaries(
    scenario,
    101,
    applyOrderingProbe(scenario, 'baseline'),
    applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned'),
  )
}

function scenarioById(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing pre-target scenario ${id}`)
  return scenario
}
