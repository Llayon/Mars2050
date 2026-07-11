import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getSimulatorPreset, SIMULATOR_PRESET_OPTIONS } from '../src/app/simulator2/simulator.presets'
import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '../src/domains/combat/combat.tier1-scenarios'
import { simulateBattle } from '../src/domains/combat/combat.engine'
import type { BattleAction, BattleActionType, BattleResult, Team, UnitRow } from '../src/domains/combat/combat.types'

const SNAPSHOT_SEED = 24680
const JSON_OUTPUT = join(process.cwd(), 'docs', 'combat-balance-snapshot.json')
const MARKDOWN_OUTPUT = join(process.cwd(), 'docs', 'combat-balance-snapshot.md')
const ACTION_TYPES: BattleActionType[] = [
  'attack',
  'damage',
  'heal',
  'die',
  'spawn',
  'spawn_blocked',
  'projectile_intercept',
  'status_apply',
  'status_cleanse',
  'shield_apply',
  'mode_change',
  'stance_change',
  'cone_attack',
  'charge_damage',
  'control_convert',
  'barrier_absorb',
  'hazard_cleanse',
  'field_effect',
]
type ScenarioGroup = 'simulator' | 'tier1'

type NumericMap = Record<string, number>
type TeamTypeCounts = Record<Team, NumericMap>

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
  metrics: {
    firstAttackTick: number | null
    averageTimeToEngage: number | null
    averageEngagementDistance: number | null
    maxOverlap: number
    averageOverlap: number
    targetSwitches: number
    meleeSlotWaitTicks: number
    overkillDamage: number
  }
  damageByUnitType: NumericMap
  damageTakenByUnitType: NumericMap
  healingDoneByUnitType: NumericMap
  actionCounts: NumericMap
}

interface CombatBalanceSnapshot {
  schemaVersion: 2
  generatedBy: 'npm run combat:snapshot'
  seed: number
  presets: { id: string; name: string }[]
  tier1Scenarios: { id: string; name: string }[]
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

  return {
    schemaVersion: 2,
    generatedBy: 'npm run combat:snapshot',
    seed: SNAPSHOT_SEED,
    presets: SIMULATOR_PRESET_OPTIONS.map(option => ({ id: option.id, name: option.name })),
    tier1Scenarios: TIER1_BALANCE_SCENARIOS.map(scenario => ({ id: scenario.id, name: scenario.name })),
    scenarios: [...simulatorScenarios, ...tier1Scenarios],
  }
}

export function summarizeScenario(presetId: string, group: ScenarioGroup, name: string, seed: number, result: BattleResult): ScenarioSummary {
  if (!result.metrics) throw new Error(`Scenario ${presetId} was simulated without combat metrics`)
  const actions = result.logs.flatMap(log => log.actions)

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
    metrics: {
      firstAttackTick: result.metrics.firstAttackTick,
      averageTimeToEngage: roundNullable(result.metrics.averageTimeToEngage),
      averageEngagementDistance: roundNullable(result.metrics.averageEngagementDistance),
      maxOverlap: roundNumber(result.metrics.maxOverlap),
      averageOverlap: roundNumber(result.metrics.averageOverlap),
      targetSwitches: result.metrics.targetSwitches,
      meleeSlotWaitTicks: result.metrics.meleeSlotWaitTicks,
      overkillDamage: roundNumber(result.metrics.overkillDamage),
    },
    damageByUnitType: sortNumericMap(result.metrics.damageByUnitType),
    damageTakenByUnitType: sortNumericMap(result.metrics.damageTakenByUnitType),
    healingDoneByUnitType: sortNumericMap(result.metrics.healingDoneByUnitType),
    actionCounts: countActionsByType(actions, ACTION_TYPES),
  }
}

function simulateSnapshotScenario(
  presetId: string,
  group: ScenarioGroup,
  name: string,
  scenario: Pick<CombatBalanceScenario, 'attackers' | 'defenders'>
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

export function countActionsByType(actions: BattleAction[], actionTypes: BattleActionType[]): NumericMap {
  const counts: NumericMap = {}
  for (const actionType of actionTypes) counts[actionType] = 0
  for (const action of actions) {
    if (action.type in counts) counts[action.type] += 1
  }
  return counts
}

export function countUnitsByTeamType(units: ReadonlyArray<{ team: Team; type: string }>): TeamTypeCounts {
  const counts: TeamTypeCounts = { attacker: {}, defender: {} }
  for (const unit of units) {
    counts[unit.team][unit.type] = (counts[unit.team][unit.type] ?? 0) + 1
  }
  return { attacker: sortNumericMap(counts.attacker), defender: sortNumericMap(counts.defender) }
}

export function renderSnapshotJson(snapshot: CombatBalanceSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`
}

export function renderSnapshotMarkdown(snapshot: CombatBalanceSnapshot): string {
  const tier1Scenarios = snapshot.scenarios.filter(scenario => scenario.group === 'tier1')

  return [
    '# Combat Balance Snapshot',
    '',
    'Generated by `npm run combat:snapshot` from deterministic simulator presets and Tier 1 role scenarios.',
    '',
    `Schema version: ${snapshot.schemaVersion}`,
    `Seed: ${snapshot.seed}`,
    `Presets: ${snapshot.presets.map(preset => `\`${preset.id}\``).join(', ')}`,
    `Tier 1 scenarios: ${snapshot.tier1Scenarios.map(scenario => `\`${scenario.id}\``).join(', ')}`,
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
    '## Unit Outcomes',
    '',
    ...snapshot.scenarios.flatMap(scenario => [
      `### ${scenario.presetId} - ${scenario.name}`,
      '',
      `- Initial units: ${formatTeamMap(scenario.initialUnits)}`,
      `- Survivors: ${formatTeamMap(scenario.survivors)}`,
      `- Damage dealt: ${formatNumericMap(scenario.damageByUnitType)}`,
      `- Damage taken: ${formatNumericMap(scenario.damageTakenByUnitType)}`,
      `- Healing done: ${formatNumericMap(scenario.healingDoneByUnitType)}`,
      `- Engagement: averageTimeToEngage=${formatNullable(scenario.metrics.averageTimeToEngage)}, averageEngagementDistance=${formatNullable(scenario.metrics.averageEngagementDistance)}, averageOverlap=${scenario.metrics.averageOverlap}, meleeSlotWaitTicks=${scenario.metrics.meleeSlotWaitTicks}, overkillDamage=${scenario.metrics.overkillDamage}`,
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

function sortNumericMap(map: NumericMap): NumericMap {
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, roundNumber(value)]))
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : roundNumber(value)
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100
}

function formatTeamMap(map: TeamTypeCounts): string {
  const parts = (['attacker', 'defender'] as const).flatMap(team =>
    Object.entries(map[team]).map(([type, count]) => `${team}.${type}=${count}`)
  )
  return parts.length > 0 ? parts.join('; ') : '-'
}

function formatNumericMap(map: NumericMap): string {
  const parts = Object.entries(map).map(([key, value]) => `${key}=${value}`)
  return parts.length > 0 ? parts.join('; ') : '-'
}

function nonZeroNumericMap(map: NumericMap): NumericMap {
  return Object.fromEntries(Object.entries(map).filter(([, value]) => value !== 0))
}

function formatNullable(value: number | null): string {
  return value === null ? '-' : String(value)
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
}

if (isMainModule()) writeSnapshotFiles(buildCombatBalanceSnapshot())
