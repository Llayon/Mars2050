import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { captureMovementPipelineCell } from './helpers/combat-movement-pipeline-probes'
import { applyOrderingProbe } from './helpers/combat-ordering-probes'
import {
  assertActorTurnMapping,
  compareActorTurnCells,
  prepareActorTurn,
  runCounterfactual,
  runDefaultActorTurnCell,
} from './helpers/combat-actor-turn-reservation-probes'
import { canonicalSerialize, compareSemanticStates } from './helpers/combat-semantic-state-diff'

describe('combat actor-turn melee reservation isolation', () => {
  it('reconstructs the certified pre-actor checkpoint for both transforms', () => {
    const scenario = primaryScenario()
    const baseline = prepareActorTurn(scenario, 101, applyOrderingProbe(scenario, 'baseline'))
    const candidate = prepareActorTurn(scenario, 101, applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned'))
    expect(() => assertActorTurnMapping(baseline, candidate)).not.toThrow()
  })

  it('matches production actor-turn execution independently for baseline and candidate', () => {
    const scenario = primaryScenario()
    const baselineProbe = applyOrderingProbe(scenario, 'baseline')
    const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const baselinePr12 = captureMovementPipelineCell(scenario, 101, 'BB', baselineProbe, 1).stage0
    const candidatePr12 = captureMovementPipelineCell(scenario, 101, 'CC', candidateProbe, 1).stage0
    const baseline = runDefaultActorTurnCell(scenario, 101, baselineProbe, 'BP', baselinePr12)
    const candidate = runDefaultActorTurnCell(scenario, 101, candidateProbe, 'CP', candidatePr12)
    expect(baseline.endpointEquivalentToProduction).toBe(true)
    expect(candidate.endpointEquivalentToProduction).toBe(true)
    expect(baseline.endpointEquivalentToPr12).toBe(true)
    expect(candidate.endpointEquivalentToPr12).toBe(true)
  })

  it('keeps order comparison separate from semantic-actor behavior comparison', () => {
    const scenario = primaryScenario()
    const baselineProbe = applyOrderingProbe(scenario, 'baseline')
    const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const baselinePr12 = captureMovementPipelineCell(scenario, 101, 'BB', baselineProbe, 1).stage0
    const candidatePr12 = captureMovementPipelineCell(scenario, 101, 'CC', candidateProbe, 1).stage0
    const baseline = runDefaultActorTurnCell(scenario, 101, baselineProbe, 'BP', baselinePr12)
    const candidate = runDefaultActorTurnCell(scenario, 101, candidateProbe, 'CP', candidatePr12)
    const comparison = compareActorTurnCells(baseline, candidate)
    expect(comparison.preActorStateEquivalent).toBe(true)
    expect(comparison.initiativeGroupMembershipEquivalent).toBe(true)
    expect(comparison.productionOrder).toBeDefined()
    expect(comparison.semanticActorBehavior).toBeDefined()
    expect(canonicalSerialize(comparison)).toBe(canonicalSerialize(compareActorTurnCells(baseline, candidate)))
  })

  it('runs the complete fresh-world same-group order counterfactual', () => {
    const scenario = primaryScenario()
    const baselineProbe = applyOrderingProbe(scenario, 'baseline')
    const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
    const baselinePr12 = captureMovementPipelineCell(scenario, 101, 'BB', baselineProbe, 1).stage0
    const candidatePr12 = captureMovementPipelineCell(scenario, 101, 'CC', candidateProbe, 1).stage0
    const baseline = runDefaultActorTurnCell(scenario, 101, baselineProbe, 'BP', baselinePr12)
    const candidate = runDefaultActorTurnCell(scenario, 101, candidateProbe, 'CP', candidatePr12)
    const result = runCounterfactual(scenario, 101, baselineProbe, candidateProbe, baseline.trace, candidate.trace)
    expect(result.cells.map(cell => cell.label)).toEqual(['BB', 'BC', 'CB', 'CC'])
    expect(result.cells.every(cell => cell.trace.groups.length === baseline.trace.groups.length)).toBe(true)
    expect(compareSemanticStates(result.cells[0]!.trace.endpoint, baseline.trace.endpoint).equivalent).toBe(true)
  })

  it('is deterministic across fresh primary reconstructions', () => {
    const first = runPrimarySummary()
    const second = runPrimarySummary()
    expect(canonicalSerialize(first)).toBe(canonicalSerialize(second))
  })
})

function runPrimarySummary() {
  const scenario = primaryScenario()
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  const baselinePr12 = captureMovementPipelineCell(scenario, 101, 'BB', baselineProbe, 1).stage0
  const candidatePr12 = captureMovementPipelineCell(scenario, 101, 'CC', candidateProbe, 1).stage0
  const baseline = runDefaultActorTurnCell(scenario, 101, baselineProbe, 'BP', baselinePr12)
  const candidate = runDefaultActorTurnCell(scenario, 101, candidateProbe, 'CP', candidatePr12)
  return { baseline: baseline.trace, candidate: candidate.trace, comparison: compareActorTurnCells(baseline, candidate) }
}

function primaryScenario(): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === 'tier1_heavy_gunner_sustained_line')
  if (!scenario) throw new Error('Missing primary actor-turn scenario')
  return scenario
}
