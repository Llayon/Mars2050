import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '../src/app/simulator2/simulator.presets'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '../src/domains/combat/combat.tier1-scenarios'
import { P0_ROLE_SCENARIOS, type CombatP0RoleScenario } from '../src/domains/combat/combat.p0-role-scenarios'
import { simulateBattle } from '../src/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '../src/domains/combat/combat.types'
import {
  ACTION_TYPES,
  buildCostEfficiency,
  countActionsByType,
  countUnitsByTeamType,
  countValueByTeamType,
  formatNullable,
  formatNumericMap,
  formatRoleSignals,
  formatTeamMap,
  formatTeamTotals,
  nonZeroNumericMap,
  roundNullable,
  roundNumber,
  sortNumericMap,
  summarizeRoleSignals,
  summarizeTeamPerformance,
  totalTeamValues,
  type CostEfficiencySummary,
  type NumericMap,
  type RoleSignalSummary,
  type TeamPerformanceSummary,
  type TeamTotals,
  type TeamTypeCounts,
} from './combat-snapshot-analysis'

const SNAPSHOT_SEED = 24680
const JSON_OUTPUT = join(process.cwd(), 'docs', 'combat-balance-snapshot.json')
const MARKDOWN_OUTPUT = join(process.cwd(), 'docs', 'combat-balance-snapshot.md')
type ScenarioGroup = 'simulator' | 'tier1' | 'p0'

interface ScenarioSummary {
  presetId: string
  group: ScenarioGroup
  name: string
  seed: number
  winner: BattleResult['winner']
  lastActionTick: number
  battleDurationTicks: number
  initialUnits: TeamTypeCounts
  survivors: TeamTypeCounts
  initialValue: TeamTypeCounts
  survivorValue: TeamTypeCounts
  teamValue: {
    initial: TeamTotals
    survivors: TeamTotals
  }
  metrics: {
    firstAttackTick: number | null
    averageTimeToEngage: number | null
    averageEngagementDistance: number | null
    overlapSamples: number
    maxOverlap: number
    averageOverlap: number
    maxOverlapRatio: number
    averageOverlapRatio: number
    severeOverlapSamples: number
    targetSwitches: number
    meleeSlotWaitTicks: number
    overkillDamage: number
  }
  damageByUnitType: NumericMap
  damageTakenByUnitType: NumericMap
  healingDoneByUnitType: NumericMap
  teamPerformance: TeamPerformanceSummary
  costEfficiency: CostEfficiencySummary
  actionCounts: NumericMap
  roleSignals: RoleSignalSummary
}

interface CombatBalanceSnapshot {
  schemaVersion: 5
  generatedBy: 'npm run combat:snapshot'
  seed: number
  presets: { id: string; name: string }[]
  tier1Scenarios: { id: string; name: string }[]
  p0Scenarios: { id: string; name: string }[]
  scenarios: ScenarioSummary[]
}

export function buildCombatBalanceSnapshot(): CombatBalanceSnapshot {
  const simulatorScenarios = SIMULATOR_PRESET_OPTIONS.map(option => {
    const preset = getSimulatorPreset(option.id)
    if (!preset) throw new Error(`Missing simulator preset: ${option.id}`)
    return simulateSnapshotScenario(option.id, 'simulator', option.name, preset)
  })
  const tier1Scenarios = TIER1_BALANCE_SCENARIOS.map(scenario =>
    simulateSnapshotScenario(scenario.id, 'tier1', scenario.name, scenario)
  )
  const p0Scenarios = P0_ROLE_SCENARIOS.map(scenario =>
    simulateSnapshotScenario(scenario.id, 'p0', scenario.name, scenario)
  )

  return {
    schemaVersion: 5,
    generatedBy: 'npm run combat:snapshot',
    seed: SNAPSHOT_SEED,
    presets: SIMULATOR_PRESET_OPTIONS.map(option => ({ id: option.id, name: option.name })),
    tier1Scenarios: TIER1_BALANCE_SCENARIOS.map(scenario => ({ id: scenario.id, name: scenario.name })),
    p0Scenarios: P0_ROLE_SCENARIOS.map(scenario => ({ id: scenario.id, name: scenario.name })),
    scenarios: [...simulatorScenarios, ...tier1Scenarios, ...p0Scenarios],
  }
}

export function summarizeScenario(presetId: string, group: ScenarioGroup, name: string, seed: number, result: BattleResult): ScenarioSummary {
  if (!result.metrics) throw new Error(`Scenario ${presetId} was simulated without combat metrics`)
  const actions = result.logs.flatMap(log => log.actions)
  const initialValue = countValueByTeamType(result.initialState)
  const survivorValue = countValueByTeamType(result.survivors)
  const teamValue = {
    initial: totalTeamValues(initialValue),
    survivors: totalTeamValues(survivorValue),
  }
  const teamPerformance = summarizeTeamPerformance(actions, result.initialState)

  return {
    presetId,
    group,
    name,
    seed,
    winner: result.winner,
    lastActionTick: result.logs.at(-1)?.tick ?? 0,
    battleDurationTicks: result.metrics.battleDurationTicks,
    initialUnits: countUnitsByTeamType(result.initialState),
    survivors: countUnitsByTeamType(result.survivors),
    initialValue,
    survivorValue,
    teamValue,
    metrics: {
      firstAttackTick: result.metrics.firstAttackTick,
      averageTimeToEngage: roundNullable(result.metrics.averageTimeToEngage),
      averageEngagementDistance: roundNullable(result.metrics.averageEngagementDistance),
      overlapSamples: result.metrics.overlapSamples,
      maxOverlap: roundNumber(result.metrics.maxOverlap),
      averageOverlap: roundNumber(result.metrics.averageOverlap),
      maxOverlapRatio: roundNumber(result.metrics.maxOverlapRatio),
      averageOverlapRatio: roundNumber(result.metrics.averageOverlapRatio),
      severeOverlapSamples: result.metrics.severeOverlapSamples,
      targetSwitches: result.metrics.targetSwitches,
      meleeSlotWaitTicks: result.metrics.meleeSlotWaitTicks,
      overkillDamage: roundNumber(result.metrics.overkillDamage),
    },
    damageByUnitType: sortNumericMap(result.metrics.damageByUnitType),
    damageTakenByUnitType: sortNumericMap(result.metrics.damageTakenByUnitType),
    healingDoneByUnitType: sortNumericMap(result.metrics.healingDoneByUnitType),
    teamPerformance,
    costEfficiency: buildCostEfficiency(teamPerformance, teamValue),
    actionCounts: countActionsByType(actions, ACTION_TYPES),
    roleSignals: summarizeRoleSignals(actions),
  }
}

function simulateSnapshotScenario(
  presetId: string,
  group: ScenarioGroup,
  name: string,
  scenario: Pick<CombatBalanceScenario | CombatP0RoleScenario, 'attackers' | 'defenders'>
): ScenarioSummary {
  const result = simulateBattle(
    cloneRows(scenario.attackers),
    cloneRows(scenario.defenders),
    SNAPSHOT_SEED,
    [],
    [],
    [],
    { trackMetrics: true }
  )
  return summarizeScenario(presetId, group, name, SNAPSHOT_SEED, result)
}

export function renderSnapshotJson(snapshot: CombatBalanceSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`
}

export function renderSnapshotMarkdown(snapshot: CombatBalanceSnapshot): string {
  const tier1Scenarios = snapshot.scenarios.filter(scenario => scenario.group === 'tier1')
  const p0Scenarios = snapshot.scenarios.filter(scenario => scenario.group === 'p0')

  return [
    '# Combat Balance Snapshot',
    '',
    'Generated by `npm run combat:snapshot` from deterministic simulator presets, Tier 1 role scenarios, and P0 utility-role scenarios.',
    '',
    `Schema version: ${snapshot.schemaVersion}`,
    `Seed: ${snapshot.seed}`,
    `Presets: ${snapshot.presets.map(preset => `\`${preset.id}\``).join(', ')}`,
    `Tier 1 scenarios: ${snapshot.tier1Scenarios.map(scenario => `\`${scenario.id}\``).join(', ')}`,
    `P0 role scenarios: ${snapshot.p0Scenarios.map(scenario => `\`${scenario.id}\``).join(', ')}`,
    '',
    'Cost/value metrics use a simple equal-weight resource value model over `hireCost`. Treat them as balance diagnostics, not final economy pricing.',
    'Overlap metrics report both raw pixels and normalized ratio; `severeOverlapSamples` counts pair samples at 50%+ normalized overlap.',
    '',
    '## Scenario Summary',
    '',
    '| Group | Preset | Winner | Last action tick | Duration | First attack | Max overlap | Target switches | Survivors |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...snapshot.scenarios.map(scenario => [
      `| ${scenario.group} | \`${scenario.presetId}\` | ${scenario.winner} | ${scenario.lastActionTick} | ${scenario.battleDurationTicks} | ${formatNullable(scenario.metrics.firstAttackTick)} | ${scenario.metrics.maxOverlap} | ${scenario.metrics.targetSwitches} | ${formatTeamMap(scenario.survivors)} |`,
    ]).flat(),
    '',
    '## Replay Action Counts',
    '',
    '| Preset | Key action counts |',
    '| --- | --- |',
    ...snapshot.scenarios.map(scenario => `| \`${scenario.presetId}\` | ${formatNumericMap(scenario.actionCounts)} |`),
    '',
    '## Tier 1 Role Scenarios',
    '',
    '| Scenario | Damage dealt | Healing done | Key action counts |',
    '| --- | --- | --- | --- |',
    ...tier1Scenarios.map(scenario => `| \`${scenario.presetId}\` | ${formatNumericMap(scenario.damageByUnitType)} | ${formatNumericMap(scenario.healingDoneByUnitType)} | ${formatNumericMap(nonZeroNumericMap(scenario.actionCounts))} |`),
    '',
    '## Tier 1 Cost Efficiency',
    '',
    '| Scenario | Initial value | Damage / cost | Healing / cost | Damage taken / cost | Survivor value | Role signals |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...tier1Scenarios.map(scenario => `| \`${scenario.presetId}\` | ${formatTeamTotals(scenario.teamValue.initial)} | ${formatTeamTotals(scenario.costEfficiency.damageDealtPerCost)} | ${formatTeamTotals(scenario.costEfficiency.healingDonePerCost)} | ${formatTeamTotals(scenario.costEfficiency.damageTakenPerCost)} | ${formatTeamTotals(scenario.costEfficiency.survivorValueRatio)} | ${formatRoleSignals(scenario.roleSignals)} |`),
    '',
    '## P0 Role Scenarios',
    '',
    '| Scenario | Initial value | Damage / cost | Healing / cost | Damage taken / cost | Survivor value | Role signals |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...p0Scenarios.map(scenario => `| \`${scenario.presetId}\` | ${formatTeamTotals(scenario.teamValue.initial)} | ${formatTeamTotals(scenario.costEfficiency.damageDealtPerCost)} | ${formatTeamTotals(scenario.costEfficiency.healingDonePerCost)} | ${formatTeamTotals(scenario.costEfficiency.damageTakenPerCost)} | ${formatTeamTotals(scenario.costEfficiency.survivorValueRatio)} | ${formatRoleSignals(scenario.roleSignals)} |`),
    '',
    '## Unit Outcomes',
    '',
    ...snapshot.scenarios.flatMap(scenario => [
      `### ${scenario.presetId} - ${scenario.name}`,
      '',
      `- Initial units: ${formatTeamMap(scenario.initialUnits)}`,
      `- Survivors: ${formatTeamMap(scenario.survivors)}`,
      `- Initial value: ${formatTeamMap(scenario.initialValue)} (${formatTeamTotals(scenario.teamValue.initial)})`,
      `- Survivor value: ${formatTeamMap(scenario.survivorValue)} (${formatTeamTotals(scenario.teamValue.survivors)})`,
      `- Damage dealt: ${formatNumericMap(scenario.damageByUnitType)}`,
      `- Damage taken: ${formatNumericMap(scenario.damageTakenByUnitType)}`,
      `- Healing done: ${formatNumericMap(scenario.healingDoneByUnitType)}`,
      `- Team performance: damageDealt=${formatTeamTotals(scenario.teamPerformance.damageDealt)}, damageTaken=${formatTeamTotals(scenario.teamPerformance.damageTaken)}, healingDone=${formatTeamTotals(scenario.teamPerformance.healingDone)}`,
      `- Cost efficiency: damageDealtPerCost=${formatTeamTotals(scenario.costEfficiency.damageDealtPerCost)}, damageTakenPerCost=${formatTeamTotals(scenario.costEfficiency.damageTakenPerCost)}, healingDonePerCost=${formatTeamTotals(scenario.costEfficiency.healingDonePerCost)}, netDamagePerCost=${formatTeamTotals(scenario.costEfficiency.netDamagePerCost)}, survivorValueRatio=${formatTeamTotals(scenario.costEfficiency.survivorValueRatio)}`,
      `- Role signals: ${formatRoleSignals(scenario.roleSignals)}`,
      `- Engagement: averageTimeToEngage=${formatNullable(scenario.metrics.averageTimeToEngage)}, averageEngagementDistance=${formatNullable(scenario.metrics.averageEngagementDistance)}, averageOverlap=${scenario.metrics.averageOverlap}, maxOverlapRatio=${scenario.metrics.maxOverlapRatio}, averageOverlapRatio=${scenario.metrics.averageOverlapRatio}, severeOverlapSamples=${scenario.metrics.severeOverlapSamples}/${scenario.metrics.overlapSamples}, meleeSlotWaitTicks=${scenario.metrics.meleeSlotWaitTicks}, overkillDamage=${scenario.metrics.overkillDamage}`,
      '',
    ]),
  ].join('\n')
}

function writeSnapshotFiles(snapshot: CombatBalanceSnapshot): void {
  writeFileSync(JSON_OUTPUT, renderSnapshotJson(snapshot), 'utf8')
  writeFileSync(MARKDOWN_OUTPUT, renderSnapshotMarkdown(snapshot), 'utf8')
  console.log(`Wrote ${JSON_OUTPUT}`)
  console.log(`Wrote ${MARKDOWN_OUTPUT}`)
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
}

if (isMainModule()) writeSnapshotFiles(buildCombatBalanceSnapshot())
