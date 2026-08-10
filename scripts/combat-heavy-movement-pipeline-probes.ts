import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { writeFileSync } from 'node:fs'
import { applyOrderingProbe } from '@/__tests__/helpers/combat-ordering-probes'
import { assertSemanticIdentityMapping, comparePipelineCells, type MovementPipelineAssessment } from '@/__tests__/helpers/combat-movement-pipeline-diagnostics'
import { captureMovementPipelineCell } from '@/__tests__/helpers/combat-movement-pipeline-probes'
import type { MovementCell, PipelineCellResult } from '@/__tests__/helpers/combat-movement-pipeline-types'

const SEEDS = [101, 202, 303, 404, 505] as const
const SCENARIOS = ['tier1_heavy_gunner_sustained_line', 'tier1_heavy_gunner_exposed', 'tier1_marine_baseline_duel'] as const
const CELLS: readonly MovementCell[] = ['BB', 'BC', 'CB', 'CC']
const jsonMode = process.argv.includes('--json')

type DiagnosticCell = Omit<PipelineCellResult, 'probe'> & { orderingTransform: string }
interface ScenarioSeedReport { scenarioId: string; seed: number; cells: Record<MovementCell, DiagnosticCell>; comparisons: Record<string, MovementPipelineAssessment>; mechanism: string }

const reports = SCENARIOS.flatMap(scenarioId => SEEDS.map(seed => buildReport(scenarioById(scenarioId), seed)))
const output = {
  diagnostic: 'combat-movement-pipeline-isolation', version: 1,
  scenarios: SCENARIOS, seeds: SEEDS, cells: CELLS, logicalCellCount: reports.length * CELLS.length,
  primary: 'tier1_heavy_gunner_sustained_line', earliestSeed: 101,
  reports, fiveSeedRepeatability: summarizeRepeatability(reports),
  controls: reports.filter(report => report.scenarioId !== 'tier1_heavy_gunner_sustained_line').map(report => ({ scenarioId: report.scenarioId, seed: report.seed, mechanism: report.mechanism })),
}
const rendered = jsonMode ? `${JSON.stringify(output, null, 2)}\n` : renderHuman(output)
const outputPath = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
if (outputPath) writeFileSync(outputPath, rendered, 'utf8')
else process.stdout.write(rendered)

function buildReport(scenario: CombatBalanceScenario, seed: number): ScenarioSeedReport {
  const baselineProbe = applyOrderingProbe(scenario, 'baseline')
  const candidateProbe = applyOrderingProbe(scenario, 'defender_cohort_rank_reassigned')
  const bb = captureMovementPipelineCell(scenario, seed, 'BB', baselineProbe)
  const candidateProduction = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe)
  const semanticOrder = candidateProduction.requests.map(request => request.semanticActor)
  const baselineOrder = bb.requests.map(request => request.semanticActor)
  const bc = captureMovementPipelineCell(scenario, seed, 'BC', baselineProbe, semanticOrder)
  const cb = captureMovementPipelineCell(scenario, seed, 'CB', candidateProbe, baselineOrder)
  const cc = captureMovementPipelineCell(scenario, seed, 'CC', candidateProbe, semanticOrder)
  const cells = { BB: bb, BC: bc, CB: cb, CC: cc }
  for (const cell of [bc, cb, cc]) assertSemanticIdentityMapping(bb, cell)
  const comparisons = {
    BB_BC: comparePipelineCells(bb, bc), BB_CB: comparePipelineCells(bb, cb),
    BC_CC: comparePipelineCells(bc, cc), CB_CC: comparePipelineCells(cb, cc),
  }
  return { scenarioId: scenario.id, seed, cells: serializeCells(cells), comparisons, mechanism: selectMechanism(Object.values(comparisons)) }
}

function serializeCells(cells: Record<MovementCell, PipelineCellResult>): Record<MovementCell, DiagnosticCell> {
  return Object.fromEntries(CELLS.map(cell => {
    const { probe, ...result } = cells[cell]
    return [cell, { ...result, orderingTransform: probe.transform }]
  })) as Record<MovementCell, DiagnosticCell>
}

function selectMechanism(assessments: MovementPipelineAssessment[]): string {
  const mechanisms = [...new Set(assessments.map(assessment => assessment.mechanism))]
  if (mechanisms.length === 1) return mechanisms[0]
  if (mechanisms.includes('ENTITY_ID_MAPPING_CONTAMINATED')) return 'ENTITY_ID_MAPPING_CONTAMINATED'
  if (mechanisms.includes('NO_DIVERGENCE') && mechanisms.length === 2) return mechanisms.find(item => item !== 'NO_DIVERGENCE') ?? 'UNRESOLVED'
  return mechanisms.length === 0 ? 'NO_DIVERGENCE' : 'MIXED'
}

function summarizeRepeatability(reports: readonly ScenarioSeedReport[]): { logicalCells: number; allStagesPresent: boolean; seedSet: readonly number[] } {
  return {
    logicalCells: reports.length * CELLS.length,
    allStagesPresent: reports.every(report => Object.keys(report.cells).length === 4 && Object.values(report.cells).every(cell => cell.stage0 && cell.requests && cell.intents && cell.collisionPairs && cell.committedTransforms)),
    seedSet: SEEDS,
  }
}

function renderHuman(value: typeof output): string {
  const lines = [`Combat movement pipeline isolation | logical cells: ${value.logicalCellCount}`, '']
  for (const report of value.reports) {
    lines.push(`${report.scenarioId} seed ${report.seed} | mechanism: ${report.mechanism}`)
    for (const cell of CELLS) {
      const result = report.cells[cell]
      lines.push(`  ${cell}: requests=${result.requests.length} intents=${result.intents.length} collisions=${result.collisionPairs.length} steeringExact=${result.exactSteeringPairs.length} collisionExact=${result.exactCollisionPairs.length}`)
    }
    for (const [key, assessment] of Object.entries(report.comparisons)) lines.push(`  ${key}: ${assessment.earliestCausalLayer} / ${assessment.stageSpecificEffect} / ${assessment.mechanism}`)
  }
  return `${lines.join('\n')}\n`
}

function scenarioById(id: string): CombatBalanceScenario {
  const scenario = TIER1_BALANCE_SCENARIOS.find(item => item.id === id)
  if (!scenario) throw new Error(`Missing heavy movement scenario ${id}`)
  return scenario
}
