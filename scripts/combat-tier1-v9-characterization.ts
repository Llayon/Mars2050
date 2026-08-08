import { TIER1_BALANCE_SCENARIOS, type CombatBalanceScenario } from '../src/domains/combat/combat.tier1-scenarios'
import { simulateBattle } from '../src/domains/combat/combat.engine'
import type { BattleResult, UnitRow } from '../src/domains/combat/combat.types'

const CHARACTERIZATION_SEED = 24680
const SIGNAL_ACTION_TYPES = [
  'charge_damage', 'cone_attack', 'mode_change', 'percent_hp_damage', 'self_destruct', 'split_fire', 'target_mark',
] as const
const JSON_OUTPUT = process.argv.includes('--json')

interface RoleSignals {
  actionCounts: Record<string, number>
  statusApplications: Record<string, number>
  damageByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
  mark: {
    markUtilization: number
    bonusDamageFromMarks: number
    targetMarkCount: number
  }
}

interface OutcomeSummary {
  winner: BattleResult['winner']
  terminationReason: BattleResult['terminationReason']
  elapsedTicks: number
  attackerRemainingPower: number
  defenderRemainingPower: number
}

interface ScenarioComparison {
  scenarioId: string
  v8: OutcomeSummary
  v9: OutcomeSummary
  derived: {
    winnerChanged: boolean
    durationDeltaTicks: number
    attackerRemainingPowerDelta: number
    defenderRemainingPowerDelta: number
  }
  roleSignals: {
    v8: RoleSignals
    v9: RoleSignals
  }
}

interface CharacterizationReport {
  seed: number
  scenarios: ScenarioComparison[]
}

function simulateScenario(scenario: CombatBalanceScenario, defenseResolutionMode: 'v8_sequential' | 'v9_snapshot'): BattleResult {
  return simulateBattle(
    cloneRows(scenario.attackers),
    cloneRows(scenario.defenders),
    CHARACTERIZATION_SEED,
    [],
    [],
    [],
    { defenseResolutionMode, trackMetrics: true },
  )
}

function buildReport(): CharacterizationReport {
  return {
    seed: CHARACTERIZATION_SEED,
    scenarios: [...TIER1_BALANCE_SCENARIOS]
      .sort((left, right) => compareStrings(left.id, right.id))
      .map(scenario => compareScenario(scenario)),
  }
}

function compareScenario(scenario: CombatBalanceScenario): ScenarioComparison {
  const v8Result = simulateScenario(scenario, 'v8_sequential')
  const v9Result = simulateScenario(scenario, 'v9_snapshot')
  const v8 = summarizeOutcome(v8Result)
  const v9 = summarizeOutcome(v9Result)
  return {
    scenarioId: scenario.id,
    v8,
    v9,
    derived: {
      winnerChanged: v8.winner !== v9.winner,
      durationDeltaTicks: v9.elapsedTicks - v8.elapsedTicks,
      attackerRemainingPowerDelta: round(v9.attackerRemainingPower - v8.attackerRemainingPower),
      defenderRemainingPowerDelta: round(v9.defenderRemainingPower - v8.defenderRemainingPower),
    },
    roleSignals: { v8: summarizeRoleSignals(v8Result), v9: summarizeRoleSignals(v9Result) },
  }
}

function summarizeOutcome(result: BattleResult): OutcomeSummary {
  const power = { attacker: 0, defender: 0 }
  for (const unit of result.survivors) power[unit.team] += unit.maxHp > 0 ? unit.hp / unit.maxHp : 0
  return {
    winner: result.winner,
    terminationReason: result.terminationReason,
    elapsedTicks: result.elapsedTicks,
    attackerRemainingPower: round(power.attacker),
    defenderRemainingPower: round(power.defender),
  }
}

function summarizeRoleSignals(result: BattleResult): RoleSignals {
  const actions = result.logs.flatMap(log => log.actions)
  const actionCounts = Object.fromEntries(SIGNAL_ACTION_TYPES.map(type => [type, actions.filter(action => action.type === type).length]))
  const statusApplications: Record<string, number> = {}
  for (const action of actions) {
    if (action.type === 'status_apply' && action.statusType) statusApplications[action.statusType] = (statusApplications[action.statusType] ?? 0) + 1
  }
  return {
    actionCounts: sortNumbers(actionCounts),
    statusApplications: sortNumbers(statusApplications),
    damageByUnitType: sortNumbers(result.metrics?.damageByUnitType ?? {}),
    healingDoneByUnitType: sortNumbers(result.metrics?.healingDoneByUnitType ?? {}),
    mark: {
      markUtilization: round(result.metrics?.mark.markUtilization ?? 0),
      bonusDamageFromMarks: round(result.metrics?.mark.bonusDamageFromMarks ?? 0),
      targetMarkCount: actions.filter(action => action.type === 'target_mark').length,
    },
  }
}

function renderHuman(report: CharacterizationReport): string {
  const lines = ['scenario | v8 winner | v9 winner | winner changed | v8 ticks | v9 ticks | attacker power delta | defender power delta']
  lines.push('--- | --- | --- | --- | ---: | ---: | ---: | ---:')
  for (const scenario of report.scenarios) {
    lines.push([
      scenario.scenarioId,
      scenario.v8.winner,
      scenario.v9.winner,
      scenario.derived.winnerChanged ? 'yes' : 'no',
      scenario.v8.elapsedTicks,
      scenario.v9.elapsedTicks,
      scenario.derived.attackerRemainingPowerDelta,
      scenario.derived.defenderRemainingPowerDelta,
    ].join(' | '))
  }
  return `${lines.join('\n')}\n`
}

function sortNumbers(values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => compareStrings(left, right)).map(([key, value]) => [key, round(value)]))
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

const report = buildReport()
process.stdout.write(JSON_OUTPUT ? `${JSON.stringify(report, null, 2)}\n` : renderHuman(report))
