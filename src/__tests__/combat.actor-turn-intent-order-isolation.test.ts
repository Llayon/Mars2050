import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import { canonicalSerialize } from './helpers/combat-semantic-state-diff'
import { loadPr12Endpoint, runIntentOrderExperiment } from './helpers/combat-actor-turn-intent-order-probes'
import { prepareActorTurn, runTracedActorTurn } from './helpers/combat-actor-turn-reservation-probes'
import { semanticizeExternalReference } from './helpers/combat-actor-turn-ledger-projection'
import { runDownstreamExperiment } from './helpers/combat-actor-turn-intent-order-downstream'
import { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import { projectLedger } from './helpers/combat-actor-turn-ledger-projection'

describe('combat actor-turn intent execution order isolation', () => {
  it('keeps all four cells on baseline semantic actor traversal', { timeout: 30000 }, () => {
    const result = runPrimary()
    const traversal = result.cells[0]!.trace.intentExecution.groups[0]!.planning.semanticActorTraversal
    for (const cell of result.cells) expect(cell.trace.intentExecution.groups[0]!.planning.semanticActorTraversal).toEqual(traversal)
  })

  it('captures production sorted intents without mutating the unsorted snapshot', { timeout: 30000 }, () => {
    const result = runPrimary()
    const group = result.cells[0]!.trace.intentExecution.groups[0]!
    const candidateGroup = result.cells[2]!.trace.intentExecution.groups[0]!
    expect(group.planning.unsortedIntents).not.toBe(group.planning.productionSortedIntents)
    expect(canonicalSerialize(candidateGroup.planning.unsortedIntents)).not.toBe(canonicalSerialize(candidateGroup.planning.productionSortedIntents))
    expect(new Set(group.planning.semanticIntentMultiset.map(item => canonicalSerialize(item)))).toEqual(new Set(group.planning.unsortedIntents.map(item => canonicalSerialize(item))))
    expect(result.baselineProductionOrder).toEqual(group.planning.productionSortedIntents)
  })

  it('rejects non-permutation intent overrides', { timeout: 30000 }, () => {
    const result = runPrimary()
    const group = result.cells[0]!.trace.intentExecution.groups[0]!
    const scenario = primaryScenario()
    const probe = applyOrderingProbe(scenario, 'baseline')
    const source = prepareActorTurn(scenario, 101, probe)
    const invalidOrder = [...group.executionOrder.slice(0, -1), group.executionOrder[0]!]
    expect(() => runTracedActorTurn(source, {
      actorOrder: { groups: [group.planning.semanticActorTraversal] },
      intentExecutionOrder: { groups: [invalidOrder] },
      stopAfterGroupOrdinal: 0,
    })).toThrow('INTENT_EXECUTION_ORDER_COUNTERFACTUAL_CONTAMINATED')
  })

  it('reports fixed-order ID effects independently of order effects', { timeout: 30000 }, () => {
    const result = runPrimary()
    expect(result.comparisons.fixedBaselineOrder).toBeDefined()
    expect(result.comparisons.fixedCandidateOrder).toBeDefined()
    expect(result.firstProductionIntentOrderDivergence).toBeDefined()
  })

  it('is deterministic across fresh reconstructions', { timeout: 30000 }, () => {
    expect(canonicalSerialize(runPrimary())).toBe(canonicalSerialize(runPrimary()))
  })

  it('semanticizes composite claim projections without losing raw evidence', () => {
    const identity = { originalRole: 'attacker' as const, originalRowId: 'unit-a', semanticSquad: 'attacker:unit-a_squad', memberOrdinal: 0 }
    const runtimeProbe = applyOrderingProbe(primaryScenario(), 'baseline')
    const baseline = { ...runtimeProbe, semanticByExternalId: new Map([...runtimeProbe.semanticByExternalId, ['abc', identity]]) }
    const candidate = { ...runtimeProbe, transform: 'defender_cohort_rank_reassigned' as const, semanticByExternalId: new Map([...runtimeProbe.semanticByExternalId, ['xyz', identity]]) }
    const source = prepareActorTurn(primaryScenario(), 101, runtimeProbe)
    const baselineLedger = createClaimLedger(source.prepared.runtime.world, 'abc')
    const candidateLedger = createClaimLedger(source.prepared.runtime.world, 'xyz')
    const baselineProjection = projectLedger(source.prepared.runtime.world, baselineLedger, baseline)
    const candidateProjection = projectLedger(source.prepared.runtime.world, candidateLedger, candidate)
    expect(baselineProjection.semanticClaimSequence).toEqual(candidateProjection.semanticClaimSequence)
    expect(baselineProjection.semanticClaimMultiset).toEqual(candidateProjection.semanticClaimMultiset)
    expect(baselineProjection.rawClaimOrderEvidence).not.toEqual(candidateProjection.rawClaimOrderEvidence)
    expect(semanticizeExternalReference('unit:abc:attack', baseline)).toBe(semanticizeExternalReference('unit:xyz:attack', candidate))
  })

  it('keeps the trace pre-intent request projection before fallback requests', { timeout: 30000 }, () => {
    const result = runPrimary()
    for (const cell of result.cells) {
      const group = cell.trace.intentExecution.groups[0]!
      expect(group.preIntentMovementRequests).toEqual(group.planning.preIntentMovementRequests)
    }
  })

  it('characterizes the eligible ICB versus ICC downstream branch', { timeout: 90000 }, () => {
    const result = runPrimary()
    const scenario = primaryScenario()
    const probe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const baselineGroup0Order = result.baselineDefault.trace.groups[0]!.processedOrder
    const candidateDefaultOrders = result.candidateDefault.trace.groups.map(group => group.processedOrder)
    const downstream = runDownstreamExperiment(
      scenario,
      101,
      probe,
      [baselineGroup0Order],
      result.baselineProductionOrder,
      result.candidateProductionOrder,
    )
    for (const cell of downstream.cells) {
      expect(cell.actorProcessingOrders[0]).toEqual(baselineGroup0Order)
      expect(cell.actorProcessingOrders.slice(1)).toEqual(candidateDefaultOrders.slice(1))
    }
    expect(downstream.precondition.requestOnlyDifference).toBe(true)
    expect(downstream.effect).toBe('REPLAY_ORDER_ONLY')
    expect(downstream.collisionEquivalent).toBe(true)
    expect(downstream.committedTransformsEquivalent).toBe(true)
    expect(downstream.movementStateEquivalent).toBe(true)
    expect(downstream.dirtyEntitiesEquivalent).toBe(true)
    expect(downstream.moveActionMultisetEquivalent).toBe(true)
    expect(downstream.moveActionSequenceEquivalent).toBe(false)
  })
})

function createClaimLedger(world: ReturnType<typeof prepareActorTurn>['prepared']['runtime']['world'], externalId: string): EcsActionGroupLedger {
  const ledger = new EcsActionGroupLedger()
  ledger.begin(world, [], { tick: 1, phaseId: 'actor_turn', groupOrdinal: 0 })
  ledger.captureClaim({
    order: {
      originExternalId: `unit:${externalId}:attack`,
      position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
      targetExternalId: `unit:${externalId}:target`,
      sourceExternalId: `unit:${externalId}:source`,
    },
    targetExternalId: `unit:${externalId}:target`,
    sourceExternalId: `unit:${externalId}:source`,
    originExternalId: `unit:${externalId}:attack`,
    authoredOrdinal: 0,
    authoredPosition: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 },
    rawDamage: 10,
  })
  return ledger
}

function runPrimary() {
  const scenario = primaryScenario()
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  return runIntentOrderExperiment(
    scenario,
    101,
    loadPr12Endpoint(scenario, 101, baselineProbe, 'BB'),
    loadPr12Endpoint(scenario, 101, candidateProbe, 'CC'),
  )
}

function primaryScenario(): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === 'tier1_heavy_gunner_sustained_line')
  if (!scenario) throw new Error('Missing primary intent-order scenario')
  return scenario
}
