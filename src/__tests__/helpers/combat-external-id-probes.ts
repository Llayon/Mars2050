import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import type { UnitRow } from '@/domains/combat/combat.types'
import {
  applyOrientationProbe,
  type OrientationProbeResult,
  type SemanticUnitIdentity,
} from './combat-orientation-probes'

export const EXTERNAL_ID_RENAME_SCHEMES = ['rank_preserving_a', 'rank_preserving_b', 'rank_preserving_c'] as const
export type ExternalIdRenameScheme = typeof EXTERNAL_ID_RENAME_SCHEMES[number]

export type ExternalIdProbeTransform =
  | 'baseline'
  | ExternalIdRenameScheme
  | 'rank_permuted'
  | 'full_mirrored_preserve_ids'
  | 'full_mirrored_rank_preserving_a'
  | 'full_mirrored_rank_preserving_b'
  | 'full_mirrored_rank_preserving_c'
  | 'full_mirrored_legacy'

export type ExternalIdProbeResult = Omit<OrientationProbeResult, 'transform'> & {
  transform: ExternalIdProbeTransform
}

const SCHEME_PREFIX: Record<ExternalIdRenameScheme, string> = {
  rank_preserving_a: 'probe-a',
  rank_preserving_b: 'probe-b',
  rank_preserving_c: 'probe-c',
}

/**
 * Applies an external-ID-only probe on top of the existing orientation contract.
 *
 * @param scenario Scenario with explicit finite positions.
 * @param transform ID transform to apply.
 * @returns Transformed rows and reversible semantic identity mapping.
 */
export function applyExternalIdProbe(
  scenario: CombatBalanceScenario,
  transform: ExternalIdProbeTransform,
): ExternalIdProbeResult {
  if (transform === 'full_mirrored_legacy') return asExternalIdProbe(applyOrientationProbe(scenario, transform), transform)

  const mirrored = transform.startsWith('full_mirrored_')
  const baseTransform = mirrored
    ? 'full_mirrored_preserve_ids'
    : transform === 'rank_permuted' ? 'external_id_permuted' : 'baseline'
  const base = applyOrientationProbe(scenario, baseTransform)
  if (transform === 'baseline' || transform === 'rank_permuted' || transform === 'full_mirrored_preserve_ids') {
    return asExternalIdProbe(base, transform)
  }

  const scheme = transform.replace('full_mirrored_', '') as ExternalIdRenameScheme
  if (!EXTERNAL_ID_RENAME_SCHEMES.includes(scheme)) throw new Error(`Unknown external-ID scheme: ${transform}`)
  return renameExternalIds(base, scheme, transform)
}

/**
 * Returns the actual compiled external IDs in canonical code-unit order.
 *
 * @param probe Transformed probe result.
 * @returns Sorted compiled IDs, including squad member suffixes.
 */
export function compiledExternalIds(probe: Pick<ExternalIdProbeResult, 'attackers' | 'defenders'>): string[] {
  return [...probe.attackers, ...probe.defenders]
    .flatMap(row => compiledIdsForRow(row))
    .sort(compareCodeUnit)
}

/**
 * Produces the semantic order represented by compiled external IDs.
 *
 * @param probe Probe with semantic mapping.
 * @returns Semantic keys in canonical compiled-ID order.
 */
export function canonicalSemanticOrder(probe: ExternalIdProbeResult): string[] {
  return compiledExternalIds(probe).map(externalId => {
    const identity = probe.semanticByExternalId.get(externalId)
    if (!identity) throw new Error(`Missing semantic mapping for compiled external ID: ${externalId}`)
    return semanticUnitKey(identity)
  })
}

export function canonicalOrderChanged(baseline: ExternalIdProbeResult, candidate: ExternalIdProbeResult): boolean {
  return JSON.stringify(canonicalSemanticOrder(baseline)) !== JSON.stringify(canonicalSemanticOrder(candidate))
}

export function rawIdStringsChanged(baseline: ExternalIdProbeResult, candidate: ExternalIdProbeResult): boolean {
  const left = semanticToExternalIds(baseline)
  const right = semanticToExternalIds(candidate)
  const keys = [...left.keys()].sort(compareCodeUnit)
  return keys.some(key => left.get(key) !== right.get(key))
}

export function semanticUnitKey(identity: SemanticUnitIdentity): string {
  return `${identity.originalRole}:${identity.originalRowId}:${identity.semanticSquad}:${identity.memberOrdinal}`
}

function renameExternalIds(
  base: OrientationProbeResult,
  scheme: ExternalIdRenameScheme,
  transform: ExternalIdProbeTransform,
): ExternalIdProbeResult {
  const rows = [...base.attackers, ...base.defenders]
  const sortedIds = rows.flatMap(row => compiledIdsForRow(row)).sort(compareCodeUnit)
  const rankByCompiledId = new Map(sortedIds.map((id, rank) => [id, rank]))
  const descriptors = rows.map(row => {
    const compiledIds = compiledIdsForRow(row)
    return {
      row,
      compiledIds,
      firstRank: Math.min(...compiledIds.map(id => rankByCompiledId.get(id) ?? Number.POSITIVE_INFINITY)),
    }
  })
  const totalRows = descriptors.length
  const rowIdByOldId = new Map<string, string>()
  for (const descriptor of descriptors) {
    const rank = transform.startsWith('full_mirrored_')
      ? descriptor.firstRank
      : descriptor.firstRank
    const rowId = `${SCHEME_PREFIX[scheme]}-${String(rank).padStart(4, '0')}-${descriptor.row.id}`
    for (const oldId of descriptor.compiledIds) rowIdByOldId.set(oldId, rowId)
  }
  if (rowIdByOldId.size !== sortedIds.length || totalRows === 0) throw new Error('Invalid external-ID rename mapping')

  const renameRows = (sourceRows: readonly UnitRow[]): UnitRow[] => sourceRows.map(row => {
    const oldId = compiledIdsForRow(row)[0]
    const newId = rowIdByOldId.get(oldId)
    if (!newId) throw new Error(`Missing renamed row ID for ${oldId}`)
    return { ...row, id: newId, upgrade_path: [...(row.upgrade_path ?? [])] }
  })
  const attackers = renameRows(base.attackers)
  const defenders = renameRows(base.defenders)
  const semanticByExternalId = remapSemanticIds(base, [...attackers, ...defenders], rows)
  validateExternalIds({ ...base, attackers, defenders, semanticByExternalId })
  return { ...base, transform, attackers, defenders, semanticByExternalId }
}

function remapSemanticIds(
  base: OrientationProbeResult,
  renamedRows: UnitRow[],
  oldRows: UnitRow[],
): Map<string, SemanticUnitIdentity> {
  const mapping = new Map<string, SemanticUnitIdentity>()
  for (let rowIndex = 0; rowIndex < renamedRows.length; rowIndex++) {
    const oldIds = compiledIdsForRow(oldRows[rowIndex])
    const newIds = compiledIdsForRow(renamedRows[rowIndex])
    for (let memberOrdinal = 0; memberOrdinal < oldIds.length; memberOrdinal++) {
      const identity = base.semanticByExternalId.get(oldIds[memberOrdinal])
      if (!identity) throw new Error(`Missing source semantic identity for ${oldIds[memberOrdinal]}`)
      mapping.set(newIds[memberOrdinal], identity)
    }
  }
  return mapping
}

function validateExternalIds(probe: Pick<ExternalIdProbeResult, 'attackers' | 'defenders' | 'semanticByExternalId'>): void {
  const ids = compiledExternalIds(probe)
  if (new Set(ids).size !== ids.length) throw new Error('External-ID transform produced duplicate compiled IDs')
  if (probe.semanticByExternalId.size !== ids.length) throw new Error('External-ID semantic mapping is incomplete')
}

function semanticToExternalIds(probe: ExternalIdProbeResult): Map<string, string> {
  return new Map([...probe.semanticByExternalId.entries()].map(([externalId, identity]) => [semanticUnitKey(identity), externalId]))
}

function compiledIdsForRow(row: UnitRow): string[] {
  const rowId = row.id
  if (!rowId) throw new Error('External-ID probe requires row IDs')
  const memberCount = UNIT_TYPES[row.unit_type].squadSize ?? 1
  return memberCount === 1 ? [rowId] : Array.from({ length: memberCount }, (_, ordinal) => `${rowId}_${ordinal}`)
}

function asExternalIdProbe(probe: OrientationProbeResult, transform: ExternalIdProbeTransform): ExternalIdProbeResult {
  validateExternalIds(probe)
  return { ...probe, transform }
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
