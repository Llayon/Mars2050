import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { Team, UnitRow } from '@/domains/combat/combat.types'
import { FIELD_HEIGHT } from '@/domains/combat/combat.utils'
import { mirrorTier1Rows } from './combat-tier1-matchup'

export type OrientationProbeTransform =
  | 'baseline'
  | 'input_order_reversed'
  | 'external_id_permuted'
  | 'center_y_reflected'
  | 'team_semantics_swapped'
  | 'full_mirrored_preserve_ids'
  | 'full_mirrored_legacy'

export interface SemanticUnitIdentity {
  originalRole: Team
  originalRowId: string
  semanticSquad: string
  memberOrdinal: number
}

export interface OrientationProbeResult {
  transform: OrientationProbeTransform
  attackers: UnitRow[]
  defenders: UnitRow[]
  roleTeam: Team
  semanticByExternalId: ReadonlyMap<string, SemanticUnitIdentity>
}

interface SourceRow {
  row: UnitRow
  originalRole: Team
  originalRowIndex: number
}

const TEAM_ORDER: Record<Team, number> = { attacker: 0, defender: 1 }

/**
 * Applies one diagnostic orientation transform without invoking combat.
 *
 * @param scenario Tier 1-compatible scenario with explicit positions.
 * @param transform Probe transform to apply.
 * @returns Transformed rows and a reversible compiled-identity mapping.
 */
export function applyOrientationProbe(
  scenario: CombatBalanceScenario,
  transform: OrientationProbeTransform,
): OrientationProbeResult {
  const sourceAttackers: SourceRow[] = scenario.attackers.map((row, originalRowIndex) => ({ row, originalRole: 'attacker', originalRowIndex }))
  const sourceDefenders: SourceRow[] = scenario.defenders.map((row, originalRowIndex) => ({ row, originalRole: 'defender', originalRowIndex }))
  const sourceRows: SourceRow[] = [...sourceAttackers, ...sourceDefenders]
  validateSourceRows(sourceRows)

  if (transform === 'full_mirrored_legacy') {
    return createLegacyMirrorResult(sourceAttackers, sourceDefenders, transform)
  }

  const swapTeams = transform === 'team_semantics_swapped' || transform === 'full_mirrored_preserve_ids'
  const reflectCenters = transform === 'center_y_reflected' || transform === 'full_mirrored_preserve_ids'
  const permuteIds = transform === 'external_id_permuted'
  const rowIdBySource = permuteIds ? createPermutedRowIds(sourceRows) : new Map<SourceRow, string>()

  let attackersSource = swapTeams ? sourceDefenders : sourceAttackers
  let defendersSource = swapTeams ? sourceAttackers : sourceDefenders
  if (transform === 'input_order_reversed') {
    attackersSource = [...attackersSource].reverse()
    defendersSource = [...defendersSource].reverse()
  }
  const attackers = transformRows(attackersSource, 'attacker', reflectCenters, rowIdBySource)
  const defenders = transformRows(defendersSource, 'defender', reflectCenters, rowIdBySource)

  validateUniqueRowIds([...attackers, ...defenders])
  return {
    transform,
    attackers,
    defenders,
    roleTeam: swapTeams ? 'defender' : 'attacker',
    semanticByExternalId: createSemanticMapping([...attackers, ...defenders], [...attackersSource, ...defendersSource]),
  }
}

function createLegacyMirrorResult(
  sourceAttackers: SourceRow[],
  sourceDefenders: SourceRow[],
  transform: OrientationProbeTransform,
): OrientationProbeResult {
  const attackers = mirrorTier1Rows(sourceDefenders.map(source => source.row), 'attacker')
  const defenders = mirrorTier1Rows(sourceAttackers.map(source => source.row), 'defender')
  validateUniqueRowIds([...attackers, ...defenders])
  return {
    transform,
    attackers,
    defenders,
    roleTeam: 'defender',
    semanticByExternalId: createSemanticMapping(
      [...attackers, ...defenders],
      [...sourceDefenders, ...sourceAttackers],
    ),
  }
}

function transformRows(
  sourceRows: SourceRow[],
  executionTeam: Team,
  reflectCenters: boolean,
  rowIdBySource: ReadonlyMap<SourceRow, string>,
): UnitRow[] {
  return sourceRows.map(source => {
    const rowId = rowIdBySource.get(source) ?? source.row.id
    return {
      ...source.row,
      id: rowId,
      colony_id: executionTeam,
      upgrade_path: [...(source.row.upgrade_path ?? [])],
      ...(reflectCenters ? { grid_y: reflectY(source.row.grid_y) } : {}),
    }
  })
}

function createPermutedRowIds(sourceRows: SourceRow[]): Map<SourceRow, string> {
  const ordered = [...sourceRows].sort((left, right) =>
    TEAM_ORDER[left.originalRole] - TEAM_ORDER[right.originalRole]
    || compareCodeUnit(left.row.id ?? '', right.row.id ?? '')
    || left.originalRowIndex - right.originalRowIndex)
  const result = new Map<SourceRow, string>()
  for (const [rank, source] of ordered.entries()) {
    const reverseRank = ordered.length - rank
    result.set(source, `probe-${String(reverseRank).padStart(4, '0')}-${source.originalRole}-${requireRowId(source.row)}`)
  }
  return result
}

function createSemanticMapping(rows: UnitRow[], sourceRows: SourceRow[]): Map<string, SemanticUnitIdentity> {
  if (rows.length !== sourceRows.length) throw new Error('Orientation probe source/output row count mismatch')
  const mapping = new Map<string, SemanticUnitIdentity>()
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const source = sourceRows[rowIndex]
    const memberCount = UNIT_TYPES[source.row.unit_type].squadSize ?? 1
    for (let memberOrdinal = 0; memberOrdinal < memberCount; memberOrdinal++) {
      const rowId = requireRowId(row)
      const externalId = memberCount > 1 ? `${rowId}_${memberOrdinal}` : rowId
      if (mapping.has(externalId)) throw new Error(`Duplicate semantic external ID: ${externalId}`)
      mapping.set(externalId, {
        originalRole: source.originalRole,
        originalRowId: requireRowId(source.row),
        semanticSquad: `${source.originalRole}:${requireRowId(source.row)}_squad`,
        memberOrdinal,
      })
    }
  }
  return mapping
}

function validateSourceRows(rows: SourceRow[]): void {
  validateExplicitPositions(rows.map(source => source.row))
  validateUniqueRowIds(rows.map(source => source.row))
}

function validateExplicitPositions(rows: UnitRow[]): void {
  for (const row of rows) {
    if (row.grid_x === undefined || row.grid_y === undefined
      || !Number.isFinite(Number(row.grid_x)) || !Number.isFinite(Number(row.grid_y))) {
      throw new Error(`Orientation probe requires explicit finite coordinates for ${row.id}`)
    }
  }
}

function validateUniqueRowIds(rows: UnitRow[]): void {
  const ids = rows.map(row => row.id)
  if (ids.some(id => id === undefined)) throw new Error('Orientation probe requires row IDs')
  if (new Set(ids).size !== ids.length) throw new Error('Orientation probe row IDs must be unique')
}

function reflectY(value: string | undefined): string {
  if (value === undefined || !Number.isFinite(Number(value))) throw new Error('Orientation probe requires a finite Y coordinate')
  return String(FIELD_HEIGHT - Number(value))
}

function requireRowId(row: UnitRow): string {
  if (row.id === undefined) throw new Error('Orientation probe requires row IDs')
  return row.id
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
