import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import { loadPr12Endpoint, runIntentOrderExperiment } from './helpers/combat-actor-turn-intent-order-probes'
import { runBatch2x2Experiment } from './helpers/combat-batch-movement-replay-order-probes'

const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === 'tier1_heavy_gunner_sustained_line')!

describe('batch movement replay order and initiative assignment isolation', () => {
  it('separates request order from initiative assignment on the certified Heavy path', { timeout: 120000 }, () => {
    const baselineProbe = applyOrderingProbe(scenario, 'baseline')
    const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const intentExperiment = runIntentOrderExperiment(
      scenario,
      101,
      loadPr12Endpoint(scenario, 101, baselineProbe, 'BB'),
      loadPr12Endpoint(scenario, 101, candidateProbe, 'CC'),
    )
    const baselineActorOrder = intentExperiment.baselineDefault.trace.groups[0]!.processedOrder
    const result = runBatch2x2Experiment(
      scenario,
      101,
      candidateProbe,
      baselineActorOrder,
      intentExperiment.baselineProductionOrder,
      intentExperiment.candidateProductionOrder,
    )
    expect(result.reference.actorTurnStateEquivalent).toBe(true)
    expect(result.reference.actorTurnActionsEquivalent).toBe(true)
    expect(result.reference.requestContentEquivalent).toBe(true)
    expect(result.reference.requestSequenceDifferent).toBe(true)
    expect(result.reference.initiativeAssignmentDifferent).toBe(true)
    expect(result.cells).toHaveLength(4)
    expect(result.cells.every(cell => cell.partitionSupported)).toBe(true)
    expect(result.cells.map(cell => cell.label)).toEqual(['RBB', 'RBC', 'RCB', 'RCC'])
    expect(result.comparisons.fixedBaselineAssignment.requestOrderEffect).toBe('NONE')
    expect(result.comparisons.fixedCandidateAssignment.requestOrderEffect).toBe('NONE')
    expect(result.comparisons.fixedBaselineOrder.initiativeAssignmentEffect).toBe('MOVE_REPLAY_ORDER_ONLY')
    expect(result.comparisons.fixedCandidateOrder.initiativeAssignmentEffect).toBe('MOVE_REPLAY_ORDER_ONLY')
    for (const pair of Object.values(result.comparisons)) {
      expect(pair.stateEquivalent).toBe(true)
      expect(pair.transformsEquivalent).toBe(true)
      expect(pair.collisionEquivalent).toBe(true)
      expect(pair.dirtyEntitiesEquivalent).toBe(true)
      expect(pair.moveActionMultisetEquivalent).toBe(true)
    }
  })
})
