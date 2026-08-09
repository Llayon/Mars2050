import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import type { Team, UnitRow } from '@/domains/combat/combat.types'
import {
  applyExternalIdProbe,
  semanticUnitKey,
} from './combat-external-id-probes'

export const ORDERING_TRANSFORMS = [
  'baseline',
  'input_order_reversed',
  'rank_preserving_a',
  'global_rank_permuted',
  'attacker_cohort_rank_reassigned',
  'defender_cohort_rank_reassigned',
  'both_cohorts_rank_reassigned',
] as const

export type OrderingTransform = typeof ORDERING_TRANSFORMS[number]

export interface OrderingCohortConfig {
  attackers: readonly string[]
  defenders: readonly string[]
}

export interface OrderingProbeResult {
  transform: OrderingTransform
  attackers: UnitRow[]
  defenders: UnitRow[]
  semanticByExternalId: ReadonlyMap<string, SemanticOrderingIdentity>
}

export interface SemanticOrderingIdentity {
  originalRole: Team
  originalRowId: string
  semanticSquad: string
  memberOrdinal: number
}

export const ORDERING_COHORTS: Record<string, OrderingCohortConfig> = {
  tier1_heavy_gunner_sustained_line: {
    attackers: ['t1-heavy-screen-a-0', 't1-heavy-screen-a-1'],
    defenders: ['t1-heavy-shock-d-0', 't1-heavy-shock-d-1', 't1-heavy-shock-d-2'],
  },
  tier1_heavy_gunner_exposed: {
    attackers: ['t1-heavy-exposed-a-0', 't1-heavy-exposed-a-1', 't1-heavy-exposed-a-2'],
    defenders: ['t1-heavy-marine-d-0', 't1-heavy-marine-d-1', 't1-heavy-marine-d-2'],
  },
  tier1_marine_baseline_duel: {
    attackers: ['t1-marine-a-0', 't1-marine-a-1', 't1-marine-a-2'],
    defenders: ['t1-marine-d-0', 't1-marine-d-1', 't1-marine-d-2'],
  },
}

interface SourceRow {
  row: UnitRow
  role: Team
}

/**
 * Applies one ordering-only transform without starting combat.
 *
 * @param scenario Tier-1 scenario with explicit row IDs and positions.
 * @param transform Diagnostic transform.
 * @returns Transformed rows with a reversible semantic member mapping.
 */
export function applyOrderingProbe(
  scenario: CombatBalanceScenario,
  transform: OrderingTransform,
): OrderingProbeResult {
  if (transform === 'rank_preserving_a' || transform === 'global_rank_permuted') {
    const externalTransform = transform === 'global_rank_permuted' ? 'rank_permuted' : 'rank_preserving_a'
    const probe = applyExternalIdProbe(scenario, externalTransform)
    return {
      transform,
      attackers: cloneRows(probe.attackers),
      defenders: cloneRows(probe.defenders),
      semanticByExternalId: probe.semanticByExternalId,
    }
  }

  const sourceAttackers = scenario.attackers.map(row => ({ row, role: 'attacker' as const }))
  const sourceDefenders = scenario.defenders.map(row => ({ row, role: 'defender' as const }))
  validateScenarioRows([...sourceAttackers, ...sourceDefenders])
  const reverse = transform === 'input_order_reversed'
  const attackers = reverse ? [...sourceAttackers].reverse() : sourceAttackers
  const defenders = reverse ? [...sourceDefenders].reverse() : sourceDefenders
  const reassigned = transform === 'attacker_cohort_rank_reassigned'
    ? { attackers: true, defenders: false }
    : transform === 'defender_cohort_rank_reassigned'
      ? { attackers: false, defenders: true }
      : transform === 'both_cohorts_rank_reassigned'
        ? { attackers: true, defenders: true }
        : { attackers: false, defenders: false }
  const config = ORDERING_COHORTS[scenario.id]
  if ((reassigned.attackers || reassigned.defenders) && !config) {
    throw new Error(`Missing explicit ordering cohort config for ${scenario.id}`)
  }
  if (config) validateOrderingCohortConfig(scenario, config)
  const attackersRows = transformRows(attackers, reassigned.attackers ? config?.attackers ?? [] : [])
  const defendersRows = transformRows(defenders, reassigned.defenders ? config?.defenders ?? [] : [])
  return {
    transform,
    attackers: attackersRows,
    defenders: defendersRows,
    semanticByExternalId: createSemanticMapping([
      ...attackersRows.map((row, index) => ({ row, source: attackers[index] })),
      ...defendersRows.map((row, index) => ({ row, source: defenders[index] })),
    ]),
  }
}

export function canonicalSemanticOrder(probe: OrderingProbeResult): string[] {
  return compiledExternalIdsForRows([...probe.attackers, ...probe.defenders]).map(externalId => {
    const identity = probe.semanticByExternalId.get(externalId)
    if (!identity) throw new Error(`Missing semantic mapping for ${externalId}`)
    return semanticUnitKey(identity)
  })
}

export function semanticOwnershipChanged(
  baseline: OrderingProbeResult,
  candidate: OrderingProbeResult,
): boolean {
  return JSON.stringify(canonicalSemanticOrder(baseline)) !== JSON.stringify(canonicalSemanticOrder(candidate))
}

export function compiledIdsForRow(row: UnitRow): string[] {
  if (!row.id) throw new Error('Ordering probe requires row IDs')
  const memberCount = UNIT_TYPES[row.unit_type].squadSize ?? 1
  return memberCount === 1 ? [row.id] : Array.from({ length: memberCount }, (_, ordinal) => `${row.id}_${ordinal}`)
}

export function validateOrderingCohortConfig(
  scenario: CombatBalanceScenario,
  config: OrderingCohortConfig,
): void {
  const rows: SourceRow[] = [
    ...scenario.attackers.map(row => ({ row, role: 'attacker' as const })),
    ...scenario.defenders.map(row => ({ row, role: 'defender' as const })),
  ]
  validateScenarioRows(rows)
  validateCohorts(rows, config)
}

function transformRows(sourceRows: SourceRow[], cohortIds: readonly string[]): UnitRow[] {
  if (cohortIds.length === 0) return sourceRows.map(source => ({
    ...source.row,
    upgrade_path: [...(source.row.upgrade_path ?? [])],
  }))
  const selected = sourceRows.filter(source => cohortIds.includes(source.row.id ?? ''))
  validateCohortRows(selected, cohortIds)
  const reassignedIds = [...selected].reverse().map(source => source.row.id ?? '')
  const replacement = new Map(selected.map((source, index) => [source.row.id ?? '', reassignedIds[index]]))
  return sourceRows.map(source => ({
    ...source.row,
    id: replacement.get(source.row.id ?? '') ?? source.row.id,
    upgrade_path: [...(source.row.upgrade_path ?? [])],
  }))
}

function createSemanticMapping(
  rows: Array<{ row: UnitRow; source: SourceRow }>,
): Map<string, SemanticOrderingIdentity> {
  const mapping = new Map<string, SemanticOrderingIdentity>()
  for (const entry of rows) {
    const oldRowId = entry.source.row.id
    if (!oldRowId) throw new Error('Ordering probe source row requires ID')
    const memberCount = UNIT_TYPES[entry.source.row.unit_type].squadSize ?? 1
    for (let memberOrdinal = 0; memberOrdinal < memberCount; memberOrdinal++) {
      const externalId = compiledIdsForRow(entry.row)[memberOrdinal]
      if (mapping.has(externalId)) throw new Error(`Duplicate semantic external ID: ${externalId}`)
      mapping.set(externalId, {
        originalRole: entry.source.role,
        originalRowId: oldRowId,
        semanticSquad: `${entry.source.role}:${oldRowId}_squad`,
        memberOrdinal,
      })
    }
  }
  return mapping
}

function validateScenarioRows(rows: SourceRow[]): void {
  const rowIds = rows.map(source => source.row.id ?? '')
  if (rowIds.some(id => id === '') || new Set(rowIds).size !== rowIds.length) throw new Error('Ordering probe requires unique row IDs')
  for (const source of rows) {
    if (source.row.grid_x === undefined || source.row.grid_y === undefined ||
        !Number.isFinite(Number(source.row.grid_x)) || !Number.isFinite(Number(source.row.grid_y))) {
      throw new Error(`Ordering probe requires finite explicit position for ${source.row.id}`)
    }
  }
}

function validateCohorts(rows: SourceRow[], config: OrderingCohortConfig): void {
  validateCohortRows(rows.filter(source => config.attackers.includes(source.row.id ?? '')), config.attackers)
  validateCohortRows(rows.filter(source => config.defenders.includes(source.row.id ?? '')), config.defenders)
}

function validateCohortRows(rows: SourceRow[], ids: readonly string[]): void {
  if (rows.length !== ids.length || new Set(ids).size !== ids.length) throw new Error('Ordering cohort does not match scenario rows')
  const first = rows[0]
  if (!first) throw new Error('Ordering cohort must not be empty')
  const type = first.row.unit_type
  const memberCount = UNIT_TYPES[type].squadSize ?? 1
  for (const source of rows) {
    if (source.row.unit_type !== type) throw new Error('Ordering cohort must have one unit_type')
    if ((UNIT_TYPES[source.row.unit_type].squadSize ?? 1) !== memberCount) throw new Error('Ordering cohort member count differs')
    if (source.role !== first.role) throw new Error('Ordering cohort crosses semantic teams')
  }
}

function cloneRows(rows: readonly UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function compiledExternalIdsForRows(rows: readonly UnitRow[]): string[] {
  return rows.flatMap(compiledIdsForRow).sort(compareCodeUnit)
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
