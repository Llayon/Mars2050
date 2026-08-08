import { TIER1_BALANCE_SCENARIOS } from '@/domains/combat/combat.tier1-scenarios'
import {
  evaluateTier1MatchupAcrossSeeds,
  TIER1_MATCHUP_SEEDS,
  type Tier1BattleRunner,
} from '@/__tests__/helpers/combat-tier1-matchup'
import { runCertifiedProductionCombat } from '@/__tests__/helpers/combat-production-runner'
import type { MatchupMatrixResult, MatchupSideSummary } from '@/__tests__/helpers/combat-matchup-matrix'

interface ScenarioDiagnostic {
  scenarioId: string
  name: string
  normal: MatchupSideSummary
  mirrored: MatchupSideSummary
  combined: MatchupSideSummary
  orientationWinRateDelta: number
  samples: Array<{ seed: number; orientation: 'normal' | 'mirrored'; roleTeam: 'attacker' | 'defender'; winner: 'attacker' | 'defender' | 'draw' }>
}

interface MatrixDiagnostic {
  scenarioCount: number
  seeds: readonly number[]
  simulationCount: number
  scenarios: ScenarioDiagnostic[]
}

const scenarios = [...TIER1_BALANCE_SCENARIOS].sort((left, right) => compareCodeUnit(left.id, right.id))
const jsonMode = process.argv.includes('--json')
let simulationCount = 0

const runBattle: Tier1BattleRunner = (...args) => {
  simulationCount++
  return runCertifiedProductionCombat(...args)
}

const diagnostics = scenarios.map(scenario => {
  const matrix = evaluateTier1MatchupAcrossSeeds({
    scenario,
    seeds: TIER1_MATCHUP_SEEDS,
    runBattle,
  })
  return toDiagnostic(scenario.id, scenario.name, matrix)
})

const expectedSimulationCount = scenarios.length * TIER1_MATCHUP_SEEDS.length * 2
if (simulationCount !== expectedSimulationCount) {
  throw new Error(`Expected ${expectedSimulationCount} simulations, received ${simulationCount}`)
}

const output: MatrixDiagnostic = {
  scenarioCount: scenarios.length,
  seeds: TIER1_MATCHUP_SEEDS,
  simulationCount,
  scenarios: diagnostics,
}

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
} else {
  process.stdout.write(renderHuman(output))
}

function toDiagnostic(scenarioId: string, name: string, matrix: MatchupMatrixResult): ScenarioDiagnostic {
  return {
    scenarioId,
    name,
    normal: matrix.normal,
    mirrored: matrix.mirrored,
    combined: matrix.combined,
    orientationWinRateDelta: matrix.orientationWinRateDelta,
    samples: matrix.samples.map(sample => ({
      seed: sample.seed,
      orientation: sample.orientation,
      roleTeam: sample.roleTeam,
      winner: sample.winner,
    })),
  }
}

function renderHuman(output: MatrixDiagnostic): string {
  const lines = [
    'Tier 1 seeded mirrored matchup matrix',
    `Scenarios: ${output.scenarioCount} | Seeds: ${output.seeds.join(', ')} | Simulations: ${output.simulationCount}`,
    '',
    'Scenario | Normal W/L/D | Mirrored W/L/D | Combined W/L/D | Normal WR | Mirrored WR | Delta | Combined median duration | Combined median power | Combined median HP ratio | Winning HP ratio',
    ...output.scenarios.map(formatScenario),
    '',
    'Largest absolute orientation deltas (orientation-sensitive):',
    ...largestDeltas(output.scenarios).map(formatDelta),
    '',
    'Scenarios with draws:',
    ...drawScenarios(output.scenarios).map(formatDraw),
    '',
    'Normal/mirrored divergence (orientation-sensitive):',
    ...divergentScenarios(output.scenarios).map(formatDivergence),
    '',
  ]
  return `${lines.join('\n')}\n`
}

function formatScenario(scenario: ScenarioDiagnostic): string {
  return [
    scenario.scenarioId,
    formatRecord(scenario.normal),
    formatRecord(scenario.mirrored),
    formatRecord(scenario.combined),
    formatPercent(scenario.normal.winRate),
    formatPercent(scenario.mirrored.winRate),
    formatSignedPercent(scenario.orientationWinRateDelta),
    formatNumber(scenario.combined.medianDurationTicks),
    formatNumber(scenario.combined.medianRoleRemainingPower),
    formatNumber(scenario.combined.medianRoleRemainingHpRatio),
    formatNumber(scenario.combined.medianWinningRemainingHpRatio),
  ].join(' | ')
}

function formatRecord(summary: MatchupSideSummary): string {
  return `${summary.wins}/${summary.losses}/${summary.draws}`
}

function formatDelta(scenario: ScenarioDiagnostic): string {
  return `${scenario.scenarioId}: ${formatSignedPercent(scenario.orientationWinRateDelta)}`
}

function formatDraw(scenario: ScenarioDiagnostic): string {
  return `${scenario.scenarioId}: normal ${scenario.normal.draws}, mirrored ${scenario.mirrored.draws}, combined ${scenario.combined.draws}`
}

function formatDivergence(scenario: ScenarioDiagnostic): string {
  return `${scenario.scenarioId}: normal ${formatRecord(scenario.normal)}, mirrored ${formatRecord(scenario.mirrored)}, delta ${formatSignedPercent(scenario.orientationWinRateDelta)}`
}

function largestDeltas(items: readonly ScenarioDiagnostic[]): ScenarioDiagnostic[] {
  return [...items]
    .sort((left, right) => Math.abs(right.orientationWinRateDelta) - Math.abs(left.orientationWinRateDelta)
      || compareCodeUnit(left.scenarioId, right.scenarioId))
    .slice(0, 5)
}

function drawScenarios(items: readonly ScenarioDiagnostic[]): ScenarioDiagnostic[] {
  return items.filter(item => item.combined.draws > 0)
}

function divergentScenarios(items: readonly ScenarioDiagnostic[]): ScenarioDiagnostic[] {
  return items.filter(item => item.normal.wins !== item.mirrored.wins
    || item.normal.losses !== item.mirrored.losses
    || item.normal.draws !== item.mirrored.draws)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number | null): string {
  return value === null ? 'null' : value.toFixed(4)
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
