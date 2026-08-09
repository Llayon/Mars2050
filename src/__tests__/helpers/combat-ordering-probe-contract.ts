import {
  canonicalSemanticOrder,
  compiledIdsForRow,
  type OrderingCohortConfig,
  type OrderingProbeResult,
  type OrderingTransform,
} from './combat-ordering-probes'
import type { UnitRow } from '@/domains/combat/combat.types'

export function validateOrderingProbe(
  baseline: OrderingProbeResult,
  candidate: OrderingProbeResult,
  transform: OrderingTransform,
  config?: OrderingCohortConfig,
): void {
  const baselineRows = [...baseline.attackers, ...baseline.defenders]
  const candidateRows = [...candidate.attackers, ...candidate.defenders]
  if (baselineRows.length !== candidateRows.length) throw new Error(`${transform}: row count changed`)
  if (transform === 'input_order_reversed' || transform.includes('cohort')) {
    assertEqualMultiset(compiledExternalIds(baselineRows), compiledExternalIds(candidateRows), `${transform}: compiled IDs`)
    assertEqualMultiset(baselineRows.map(row => row.id ?? ''), candidateRows.map(row => row.id ?? ''), `${transform}: row IDs`)
    assertEqualMultiset(squadIds(baselineRows), squadIds(candidateRows), `${transform}: squad IDs`)
  }
  if (transform.includes('cohort')) {
    if (!config) throw new Error(`${transform}: missing cohort config`)
    validateUnchangedGameplayRows(baselineRows, candidateRows)
    if (JSON.stringify(canonicalSemanticOrder(baseline)) === JSON.stringify(canonicalSemanticOrder(candidate))) {
      throw new Error(`${transform}: selected cohort did not change semantic lexical ownership`)
    }
  }
  const ids = compiledExternalIds(candidateRows)
  if (new Set(ids).size !== ids.length || candidate.semanticByExternalId.size !== ids.length) {
    throw new Error(`${transform}: compiled semantic ID mapping is invalid`)
  }
}

export function semanticSquadPartition(probe: OrderingProbeResult): string[] {
  return [...probe.semanticByExternalId.values()]
    .map(identity => `${identity.semanticSquad}:${identity.memberOrdinal}`)
    .sort(compareCodeUnit)
}

function validateUnchangedGameplayRows(
  baselineRows: readonly UnitRow[],
  candidateRows: readonly UnitRow[],
): void {
  for (let index = 0; index < baselineRows.length; index++) {
    const left = baselineRows[index]
    const right = candidateRows[index]
    if (left.unit_type !== right.unit_type || left.colony_id !== right.colony_id || left.hp_current !== right.hp_current ||
        left.tier !== right.tier || left.grid_x !== right.grid_x || left.grid_y !== right.grid_y ||
        JSON.stringify(left.upgrade_path ?? []) !== JSON.stringify(right.upgrade_path ?? [])) {
      throw new Error('Cohort reassignment changed gameplay row fields')
    }
  }
}

function compiledExternalIds(rows: readonly UnitRow[]): string[] {
  return rows.flatMap(compiledIdsForRow).sort(compareCodeUnit)
}

function squadIds(rows: readonly UnitRow[]): string[] {
  return rows.map(row => `${row.colony_id}:${row.id}_squad`).sort(compareCodeUnit)
}

function assertEqualMultiset(left: readonly string[], right: readonly string[], label: string): void {
  if (JSON.stringify([...left].sort(compareCodeUnit)) !== JSON.stringify([...right].sort(compareCodeUnit))) {
    throw new Error(`${label} changed`)
  }
}

function compareCodeUnit(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
