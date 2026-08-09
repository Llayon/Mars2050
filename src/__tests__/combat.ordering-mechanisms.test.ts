import { describe, expect, it } from 'vitest'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import {
  ORDERING_COHORTS,
  ORDERING_TRANSFORMS,
  applyOrderingProbe,
  canonicalSemanticOrder,
  compiledIdsForRow,
  validateOrderingCohortConfig,
  type OrderingProbeResult,
  type OrderingTransform,
} from './helpers/combat-ordering-probes'
import { semanticSquadPartition, validateOrderingProbe } from './helpers/combat-ordering-probe-contract'

const SCENARIO_IDS = [
  'tier1_heavy_gunner_sustained_line',
  'tier1_heavy_gunner_exposed',
  'tier1_marine_baseline_duel',
] as const

describe('ordering mechanism probe transforms', () => {
  it('keeps baseline identity and input-order reversal semantic', () => {
    for (const scenario of selectedScenarios()) {
      const baseline = applyOrderingProbe(scenario, 'baseline')
      const reversed = applyOrderingProbe(scenario, 'input_order_reversed')
      expect(rowIds(reversed)).toEqual({
        attackers: [...rowIds(baseline).attackers].reverse(),
        defenders: [...rowIds(baseline).defenders].reverse(),
      })
      expect(canonicalSemanticOrder(reversed)).toEqual(canonicalSemanticOrder(baseline))
      validateOrderingProbe(baseline, reversed, 'input_order_reversed')
    }
  })

  it('preserves canonical order while changing rank-preserving raw IDs', () => {
    for (const scenario of selectedScenarios()) {
      const baseline = applyOrderingProbe(scenario, 'baseline')
      const renamed = applyOrderingProbe(scenario, 'rank_preserving_a')
      expect(canonicalSemanticOrder(renamed)).toEqual(canonicalSemanticOrder(baseline))
      expect(compiledIdMultiset(renamed)).not.toEqual(compiledIdMultiset(baseline))
      validateOrderingProbe(baseline, renamed, 'rank_preserving_a')
    }
  })

  it('changes canonical ownership under global rank permutation', () => {
    for (const scenario of selectedScenarios()) {
      const baseline = applyOrderingProbe(scenario, 'baseline')
      const permuted = applyOrderingProbe(scenario, 'global_rank_permuted')
      expect(canonicalSemanticOrder(permuted)).not.toEqual(canonicalSemanticOrder(baseline))
      validateOrderingProbe(baseline, permuted, 'global_rank_permuted')
    }
  })

  it('reassigns only selected homogeneous cohorts while preserving semantic squads', () => {
    const cohortTransforms: OrderingTransform[] = [
      'attacker_cohort_rank_reassigned',
      'defender_cohort_rank_reassigned',
      'both_cohorts_rank_reassigned',
    ]
    for (const scenario of selectedScenarios()) {
      const config = ORDERING_COHORTS[scenario.id]
      validateOrderingCohortConfig(scenario, config)
      const baseline = applyOrderingProbe(scenario, 'baseline')
      for (const transform of cohortTransforms) {
        const candidate = applyOrderingProbe(scenario, transform)
        validateOrderingProbe(baseline, candidate, transform, config)
        expect(semanticSquadPartition(candidate)).toEqual(semanticSquadPartition(baseline))
        expect(compiledIdMultiset(candidate)).toEqual(compiledIdMultiset(baseline))
        expect(semanticOwnershipChangedForSelectedCohort(baseline, candidate, config, transform)).toBe(true)
        expect(unselectedOwnershipUnchanged(baseline, candidate, config, transform)).toBe(true)
      }
    }
  })

  it('rejects a heterogeneous explicit cohort configuration', () => {
    const scenario = selectedScenarios().find(item => item.id === 'tier1_heavy_gunner_sustained_line')!
    expect(() => validateOrderingCohortConfig(scenario, {
      attackers: ['t1-heavy-a', 't1-heavy-screen-a-0'],
      defenders: ['t1-heavy-shock-d-0'],
    })).toThrow(/one unit_type/)
  })
})

function selectedScenarios(): CombatBalanceScenario[] {
  return SCENARIO_IDS.map(id => {
    const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
    if (!scenario) throw new Error(`Missing ordering scenario ${id}`)
    return scenario
  })
}

function rowIds(probe: OrderingProbeResult): { attackers: string[]; defenders: string[] } {
  return {
    attackers: probe.attackers.map(row => row.id ?? ''),
    defenders: probe.defenders.map(row => row.id ?? ''),
  }
}

function compiledIdMultiset(probe: OrderingProbeResult): string[] {
  return [...probe.attackers, ...probe.defenders]
    .flatMap(compiledIdsForRow)
    .sort(compareCodeUnit)
}

function semanticOwnershipChangedForSelectedCohort(
  baseline: OrderingProbeResult,
  candidate: OrderingProbeResult,
  config: { attackers: readonly string[]; defenders: readonly string[] },
  transform: OrderingTransform,
): boolean {
  const selected = transform === 'attacker_cohort_rank_reassigned'
    ? new Set(config.attackers)
    : transform === 'defender_cohort_rank_reassigned'
      ? new Set(config.defenders)
      : new Set([...config.attackers, ...config.defenders])
  const baselineOwnership = semanticOwnership(baseline)
  const candidateOwnership = semanticOwnership(candidate)
  return [...selected].some(rowId => baselineOwnership.get(rowId) !== candidateOwnership.get(rowId))
}

function unselectedOwnershipUnchanged(
  baseline: OrderingProbeResult,
  candidate: OrderingProbeResult,
  config: { attackers: readonly string[]; defenders: readonly string[] },
  transform: OrderingTransform,
): boolean {
  const selected = transform === 'attacker_cohort_rank_reassigned'
    ? new Set(config.attackers)
    : transform === 'defender_cohort_rank_reassigned'
      ? new Set(config.defenders)
      : new Set([...config.attackers, ...config.defenders])
  const baselineOwnership = semanticOwnership(baseline)
  const candidateOwnership = semanticOwnership(candidate)
  return [...baselineOwnership.keys()]
    .filter(rowId => !selected.has(rowId))
    .every(rowId => baselineOwnership.get(rowId) === candidateOwnership.get(rowId))
}

function semanticOwnership(probe: OrderingProbeResult): Map<string, string> {
  const result = new Map<string, string>()
  for (const [externalId, identity] of probe.semanticByExternalId) {
    if (identity.memberOrdinal === 0) result.set(identity.originalRowId, externalId)
  }
  return result
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
