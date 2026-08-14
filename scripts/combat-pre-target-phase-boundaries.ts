import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { writeFileSync } from 'node:fs'
import { applyOrderingProbe } from '@/__tests__/helpers/combat-ordering-probes'
import { captureMovementPipelineCell } from '@/__tests__/helpers/combat-movement-pipeline-probes'
import {
  compareSemanticStates,
  type SemanticStateComparison,
} from '@/__tests__/helpers/combat-semantic-state-diff'
import {
  scanPreTargetPhaseBoundaries,
  type PhaseBoundaryScanResult,
} from '@/__tests__/helpers/combat-phase-boundary-probes'
import { validateSchedulerEquivalence } from '@/__tests__/helpers/combat-phase-scheduler-equivalence'

const PRIMARY_SCENARIO = 'tier1_heavy_gunner_sustained_line' as const
const SEEDS = [101, 202, 303, 404, 505] as const
const CONTROL_SCENARIOS = ['tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel'] as const
const jsonMode = process.argv.includes('--json')

const primaryScenario = scenarioById(PRIMARY_SCENARIO)
const primaryScan = scanScenario(primaryScenario, 101)
const selfValidation = {
  baseline: summarizeSelfValidation(primaryScenario, 101, 'baseline'),
  candidate: summarizeSelfValidation(primaryScenario, 101, 'defender_cohort_rank_reassigned'),
}
const primaryEndpoint = comparePr11Endpoint(primaryScenario, primaryScan, 101)
const targetBoundary = primaryScan.firstDivergentBoundary?.current.ordinal ?? null
const previousBoundary = primaryScan.firstDivergentBoundary?.previous?.ordinal ?? null
if (targetBoundary === null || previousBoundary === null) throw new Error('PR12_PRIMARY_DIVERGENCE_NOT_FOUND')

const output = {
  diagnostic: 'combat-pre-target-state-isolation',
  version: 1,
  targetTick: 1,
  primary: {
    scenarioId: PRIMARY_SCENARIO,
    seed: 101,
    selfValidation,
    pr11EndpointReproduction: primaryEndpoint,
    scan: primaryScan,
  },
  fiveSeedRepeatability: SEEDS.map(seed => summarizeSeed(seed, scanScenario(primaryScenario, seed), previousBoundary, targetBoundary)),
  controls: CONTROL_SCENARIOS.map(scenarioId => summarizeControl(scenarioById(scenarioId), 101, previousBoundary, targetBoundary)),
}

const rendered = jsonMode ? `${JSON.stringify(output, null, 2)}\n` : renderHuman(output)
const outputPath = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
if (outputPath) writeFileSync(outputPath, rendered, 'utf8')
else process.stdout.write(rendered)

function scanScenario(scenario: CombatBalanceScenario, seed: number): PhaseBoundaryScanResult {
  return scanPreTargetPhaseBoundaries(
    scenario,
    seed,
    applyOrderingProbe(scenario, 'baseline'),
    applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned'),
  )
}

function summarizeSelfValidation(
  scenario: CombatBalanceScenario,
  seed: number,
  transform: 'baseline' | 'defender_cohort_rank_reassigned',
) {
  const result = validateSchedulerEquivalence(scenario, seed, applyOrderingProbe(scenario, transform))
  return {
    equivalent: result.equivalent,
    productionActionCount: result.productionActions.length,
    manualActionCount: result.manualActions.length,
    productionTerminal: result.productionTerminal,
    manualTerminal: result.manualTerminal,
    productionClock: result.productionState.clock,
    manualClock: result.manualState.clock,
  }
}

function comparePr11Endpoint(
  scenario: CombatBalanceScenario,
  scan: PhaseBoundaryScanResult,
  seed: number,
): { baseline: SemanticStateComparison; candidate: SemanticStateComparison; reproduced: boolean; divergenceReproduced: boolean } {
  if (!scan.baselineEndpoint || !scan.candidateEndpoint) throw new Error('PR12_ENDPOINT_MISSING')
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  const baselinePr11 = captureMovementPipelineCell(scenario, seed, 'BB', baselineProbe, 1).stage0
  const candidatePr11 = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe, 1).stage0
  const baseline = compareSemanticStates(scan.baselineEndpoint, baselinePr11)
  const candidate = compareSemanticStates(scan.candidateEndpoint, candidatePr11)
  const divergenceReproduced = !compareSemanticStates(scan.baselineEndpoint, scan.candidateEndpoint).equivalent
  return { baseline, candidate, reproduced: baseline.equivalent && candidate.equivalent, divergenceReproduced }
}

function summarizeSeed(
  seed: number,
  scan: PhaseBoundaryScanResult,
  previousBoundary: number,
  targetBoundary: number,
) {
  const before = scan.boundaries[previousBoundary]
  const after = scan.boundaries[targetBoundary]
  const first = scan.firstDivergentBoundary
  const classification = first?.current.ordinal === targetBoundary
    ? 'REPRODUCED'
    : first && first.current.ordinal < targetBoundary
      ? 'PRE_BOUNDARY_ALREADY_DIVERGENT'
      : after?.equivalentToCandidate === true
        ? 'POST_BOUNDARY_CONVERGED'
        : 'NOT_REPRODUCED'
  return {
    seed,
    classification,
    preBoundaryEquivalent: before?.equivalentToCandidate ?? false,
    postBoundaryEquivalent: after?.equivalentToCandidate ?? false,
    transitionReproduced: before?.equivalentToCandidate === true && after?.equivalentToCandidate === false,
    firstDivergentBoundary: first,
  }
}

function summarizeControl(
  scenario: CombatBalanceScenario,
  seed: number,
  previousBoundary: number,
  targetBoundary: number,
) {
  const scan = scanScenario(scenario, seed)
  const before = scan.boundaries[previousBoundary]
  const after = scan.boundaries[targetBoundary]
  return {
    scenarioId: scenario.id,
    seed,
    classification: scan.classification,
    preBoundaryEquivalent: before?.equivalentToCandidate ?? false,
    postBoundaryEquivalent: after?.equivalentToCandidate ?? false,
    firstDivergentBoundary: scan.firstDivergentBoundary,
  }
}

function renderHuman(value: typeof output): string {
  const lines = [
    `Combat pre-target state isolation | ${value.primary.scenarioId} seed ${value.primary.seed}`,
    `self-validation: baseline=${value.primary.selfValidation.baseline.equivalent} candidate=${value.primary.selfValidation.candidate.equivalent}`,
    `PR11 endpoint: reproduced=${value.primary.pr11EndpointReproduction.reproduced} divergence=${value.primary.pr11EndpointReproduction.divergenceReproduced}`,
    '',
  ]
  for (const boundary of value.primary.scan.boundaries) {
    lines.push(`${boundary.ordinal.toString().padStart(2, '0')} ${boundary.label} | ${boundary.equivalentToCandidate ? 'SAME' : 'DIFFERENT'} | baseline=${boundary.baselineSemanticStateHash.slice(0, 12)} candidate=${boundary.candidateSemanticStateHash.slice(0, 12)}`)
    if (boundary.firstSemanticStateDivergence) {
      const diff = boundary.firstSemanticStateDivergence
      lines.push(`    ${diff.semanticActor} ${diff.component}.${diff.fieldPath}: ${JSON.stringify(diff.baselineValue)} -> ${JSON.stringify(diff.candidateValue)}`)
    }
  }
  lines.push('', 'Five-seed repeatability:')
  for (const result of value.fiveSeedRepeatability) lines.push(`  ${result.seed}: ${result.classification} pre=${result.preBoundaryEquivalent} post=${result.postBoundaryEquivalent}`)
  lines.push('', 'Controls:')
  for (const result of value.controls) lines.push(`  ${result.scenarioId}: ${result.classification} pre=${result.preBoundaryEquivalent} post=${result.postBoundaryEquivalent}`)
  return `${lines.join('\n')}\n`
}

function scenarioById(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing pre-target scenario ${id}`)
  return scenario
}
