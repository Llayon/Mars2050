import { UNIT_TYPES } from '../src/domains/combat/combat.config'
import type { BattleAction, BattleActionType, Team, UnitTypeKey } from '../src/domains/combat/combat.types'

export const ACTION_TYPES: BattleActionType[] = [
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

const ROLE_SIGNAL_ACTION_TYPES: BattleActionType[] = [
  'heal',
  'status_apply',
  'status_cleanse',
  'shield_apply',
  'spawn',
  'spawn_blocked',
  'projectile_intercept',
  'mode_change',
  'stance_change',
  'burrow_change',
  'stealth_change',
  'cone_attack',
  'beam_tick',
  'barrage_impact',
  'chain_jump',
  'split_fire',
  'side_weapon_attack',
  'ramp_charge',
  'charge_damage',
  'percent_hp_damage',
  'on_kill',
  'periodic_ability',
  'trigger_effect',
  'control_convert',
  'field_effect',
  'hazard_cleanse',
  'barrier_absorb',
  'barrier_spawn',
  'adjacency_bonus',
  'sweep_hit',
  'reassembly_start',
  'reassembly_complete',
  'attack_charge_release',
]

const RESOURCE_VALUE_WEIGHTS: Record<string, number> = {
  minerals: 1,
  energy: 1,
  water: 1,
  food: 1,
  oxygen: 1,
  research_points: 1,
  consumer_goods: 1,
  rare_metals: 1,
  databanks: 1,
  nanomaterials: 1,
}

export type NumericMap = Record<string, number>
export type TeamTypeCounts = Record<Team, NumericMap>
export type TeamTotals = Record<Team, number>

export interface TeamPerformanceSummary {
  damageDealt: TeamTotals
  damageTaken: TeamTotals
  healingDone: TeamTotals
}

export interface CostEfficiencySummary {
  damageDealtPerCost: TeamTotals
  damageTakenPerCost: TeamTotals
  healingDonePerCost: TeamTotals
  netDamagePerCost: TeamTotals
  survivorValueRatio: TeamTotals
}

export interface RoleSignalSummary {
  actions: NumericMap
  statusApplications: NumericMap
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

export function countValueByTeamType(units: ReadonlyArray<{ team: Team; type: string }>): TeamTypeCounts {
  const values: TeamTypeCounts = { attacker: {}, defender: {} }
  for (const unit of units) {
    values[unit.team][unit.type] = (values[unit.team][unit.type] ?? 0) + getExpandedUnitValue(unit.type)
  }
  return { attacker: sortNumericMap(values.attacker), defender: sortNumericMap(values.defender) }
}

export function totalTeamValues(values: TeamTypeCounts): TeamTotals {
  return {
    attacker: roundNumber(sumNumericMap(values.attacker)),
    defender: roundNumber(sumNumericMap(values.defender)),
  }
}

export function summarizeRoleSignals(actions: BattleAction[]): RoleSignalSummary {
  const roleActionCounts = nonZeroNumericMap(countActionsByType(actions, ROLE_SIGNAL_ACTION_TYPES))
  const statusApplications: NumericMap = {}
  for (const action of actions) {
    if (action.type === 'status_apply' && action.statusType) {
      statusApplications[action.statusType] = (statusApplications[action.statusType] ?? 0) + 1
    }
  }
  return {
    actions: sortNumericMap(roleActionCounts),
    statusApplications: sortNumericMap(statusApplications),
  }
}

export function summarizeTeamPerformance(
  actions: BattleAction[],
  units: ReadonlyArray<{ id: string; team: Team }>
): TeamPerformanceSummary {
  const unitById = new Map(units.map(unit => [unit.id, unit.team]))
  const summary: TeamPerformanceSummary = {
    damageDealt: emptyTeamTotals(),
    damageTaken: emptyTeamTotals(),
    healingDone: emptyTeamTotals(),
  }

  for (const action of actions) {
    const value = Math.max(0, action.damage ?? 0)
    if (value <= 0) continue

    if (action.type === 'damage' || action.type === 'damage_share') {
      const actorTeam = unitById.get(action.unitId)
      const targetTeam = action.targetId ? unitById.get(action.targetId) : undefined
      if (actorTeam) summary.damageDealt[actorTeam] += value
      if (targetTeam) summary.damageTaken[targetTeam] += value
    }

    if (action.type === 'heal') {
      const actorTeam = unitById.get(action.unitId)
      if (actorTeam) summary.healingDone[actorTeam] += value
    }
  }

  return {
    damageDealt: roundTeamTotals(summary.damageDealt),
    damageTaken: roundTeamTotals(summary.damageTaken),
    healingDone: roundTeamTotals(summary.healingDone),
  }
}

export function buildCostEfficiency(
  teamPerformance: TeamPerformanceSummary,
  teamValue: { initial: TeamTotals; survivors: TeamTotals }
): CostEfficiencySummary {
  return {
    damageDealtPerCost: divideTeamTotals(teamPerformance.damageDealt, teamValue.initial),
    damageTakenPerCost: divideTeamTotals(teamPerformance.damageTaken, teamValue.initial),
    healingDonePerCost: divideTeamTotals(teamPerformance.healingDone, teamValue.initial),
    netDamagePerCost: divideTeamTotals(subtractTeamTotals(teamPerformance.damageDealt, teamPerformance.damageTaken), teamValue.initial),
    survivorValueRatio: divideTeamTotals(teamValue.survivors, teamValue.initial),
  }
}

export function sortNumericMap(map: NumericMap): NumericMap {
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, roundNumber(value)]))
}

export function roundNullable(value: number | null): number | null {
  return value === null ? null : roundNumber(value)
}

export function roundNumber(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatTeamMap(map: TeamTypeCounts): string {
  const parts = (['attacker', 'defender'] as const).flatMap(team =>
    Object.entries(map[team]).map(([type, count]) => `${team}.${type}=${count}`)
  )
  return parts.length > 0 ? parts.join('; ') : '-'
}

export function formatTeamTotals(totals: TeamTotals): string {
  return `attacker=${totals.attacker}; defender=${totals.defender}`
}

export function formatRoleSignals(roleSignals: RoleSignalSummary): string {
  const actionSignals = formatNumericMap(roleSignals.actions)
  const statusSignals = formatNumericMap(roleSignals.statusApplications)
  if (actionSignals === '-' && statusSignals === '-') return '-'
  if (statusSignals === '-') return actionSignals
  if (actionSignals === '-') return `status:${statusSignals}`
  return `${actionSignals}; status:${statusSignals}`
}

export function formatNumericMap(map: NumericMap): string {
  const parts = Object.entries(map).map(([key, value]) => `${key}=${value}`)
  return parts.length > 0 ? parts.join('; ') : '-'
}

export function nonZeroNumericMap(map: NumericMap): NumericMap {
  return Object.fromEntries(Object.entries(map).filter(([, value]) => value !== 0))
}

export function formatNullable(value: number | null): string {
  return value === null ? '-' : String(value)
}

function getExpandedUnitValue(type: string): number {
  if (!(type in UNIT_TYPES)) return 0
  const config = UNIT_TYPES[type as UnitTypeKey]
  return getHireCostValue(config.hireCost) / (config.squadSize ?? 1)
}

function getHireCostValue(hireCost: Record<string, number>): number {
  return Object.entries(hireCost).reduce((sum, [resource, amount]) => sum + amount * (RESOURCE_VALUE_WEIGHTS[resource] ?? 1), 0)
}

function emptyTeamTotals(): TeamTotals {
  return { attacker: 0, defender: 0 }
}

function roundTeamTotals(totals: TeamTotals): TeamTotals {
  return { attacker: roundNumber(totals.attacker), defender: roundNumber(totals.defender) }
}

function divideTeamTotals(numerator: TeamTotals, denominator: TeamTotals): TeamTotals {
  return {
    attacker: denominator.attacker > 0 ? roundNumber(numerator.attacker / denominator.attacker) : 0,
    defender: denominator.defender > 0 ? roundNumber(numerator.defender / denominator.defender) : 0,
  }
}

function subtractTeamTotals(left: TeamTotals, right: TeamTotals): TeamTotals {
  return { attacker: left.attacker - right.attacker, defender: left.defender - right.defender }
}

function sumNumericMap(map: NumericMap): number {
  return Object.values(map).reduce((sum, value) => sum + value, 0)
}
