import type { EcsActionGroupLedger } from '@/domains/combat/combat.action-intent'
import type { CombatWorld } from '@/domains/combat/ecs/combat-world'
import type { OrderingProbeResult } from './combat-ordering-probes'
import { canonicalSerialize } from './combat-semantic-state-diff'
import { semanticId } from './combat-actor-turn-reservation-utils'
import type { DiagnosticRecord, DynamicSemanticLedgerSnapshot } from './combat-actor-turn-intent-order-types'

export interface LedgerProjection {
  semantic: DynamicSemanticLedgerSnapshot
  semanticClaimSequence: DiagnosticRecord[]
  semanticClaimMultiset: DiagnosticRecord[]
  rawClaimOrderEvidence: DiagnosticRecord[]
}

export function projectLedger(world: CombatWorld, ledger: EcsActionGroupLedger, probe: OrderingProbeResult): LedgerProjection {
  const semanticClaims = ledger.claims.map(claim => semanticize(claim, world, probe) as DiagnosticRecord)
  const rawClaims = ledger.claims.map(claim => structuredClone(claim) as unknown as DiagnosticRecord)
  const semantic = {
    claims: semanticClaims,
    damage: projectMap(ledger.damage, world, probe),
    healing: projectMap(ledger.healing, world, probe),
    forcedDeaths: projectMap(ledger.forcedDeaths, world, probe),
    statuses: ledger.statuses.map(item => semanticize(item, world, probe) as DiagnosticRecord),
    marks: ledger.marks.map(item => semanticize(item, world, probe) as DiagnosticRecord),
    defenseGrants: ledger.defenseGrants.map(item => semanticize(item, world, probe) as DiagnosticRecord),
    resolvedDamageTaken: ledger.resolvedDamageTaken.map(item => semanticize(item, world, probe) as DiagnosticRecord),
    barrierExpirations: [...ledger.barrierExpirations].sort(),
    barrierBreaks: [...ledger.barrierBreaks].sort(),
  }
  return {
    semantic,
    semanticClaimSequence: structuredClone(semanticClaims),
    semanticClaimMultiset: sortRecords(semanticClaims),
    rawClaimOrderEvidence: rawClaims.map(claim => ({
      originExternalId: claim.originExternalId,
      sourceExternalId: claim.sourceExternalId,
      targetExternalId: claim.targetExternalId,
      authoredOrdinal: claim.authoredOrdinal,
      authoredPosition: claim.authoredPosition,
      order: claim.order,
    })),
  }
}

export function captureLedgerFrameGuard(world: CombatWorld, ledger: EcsActionGroupLedger, probe: OrderingProbeResult): unknown {
  return semanticize({ frame: ledger.frame, groupKey: ledger.groupKey, active: ledger.active }, world, probe)
}

export function ledgerDelta(before: DynamicSemanticLedgerSnapshot, after: DynamicSemanticLedgerSnapshot): unknown {
  return Object.fromEntries(Object.keys(after).map(field => [field, contribution(before[field as keyof DynamicSemanticLedgerSnapshot], after[field as keyof DynamicSemanticLedgerSnapshot])]))
}

function contribution(before: unknown, after: unknown): unknown {
  if (Array.isArray(before) && Array.isArray(after)) {
    const remaining = [...before]
    return after.filter(item => {
      const index = remaining.findIndex(previous => canonicalSerialize(previous) === canonicalSerialize(item))
      if (index < 0) return true
      remaining.splice(index, 1)
      return false
    })
  }
  return canonicalSerialize(before) === canonicalSerialize(after) ? null : after
}

function projectMap(map: ReadonlyMap<number, unknown>, world: CombatWorld, probe: OrderingProbeResult): DiagnosticRecord[] {
  return [...map.entries()]
    .map(([entityId, value]) => ({ semanticActor: semanticId(world, entityId, probe), value: semanticize(value, world, probe) }))
    .sort((left, right) => left.semanticActor < right.semanticActor ? -1 : left.semanticActor > right.semanticActor ? 1 : 0)
}

function sortRecords(values: readonly DiagnosticRecord[]): DiagnosticRecord[] {
  return [...values].sort((left, right) => canonicalSerialize(left).localeCompare(canonicalSerialize(right)))
}

function semanticize(value: unknown, world: CombatWorld, probe: OrderingProbeResult, key?: string): unknown {
  if (Array.isArray(value)) return value.map(item => semanticize(item, world, probe, key))
  if (value instanceof Map) return [...value.entries()].map(([entryKey, entryValue]) => [semanticize(entryKey, world, probe, key), semanticize(entryValue, world, probe, key)])
  if (value instanceof Set) return [...value].map(item => semanticize(item, world, probe, key)).sort()
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.entries(record).map(([field, item]) => [field, semanticize(item, world, probe, field)]))
  }
  if (typeof value === 'number' && key?.endsWith('Id')) {
    const identity = world.stores.identity.get(value)
    return identity ? semanticId(world, value, probe) : value
  }
  if (typeof value === 'string' && (probe.semanticByExternalId.has(value) || /(?:ExternalId|externalId|sourceId|targetId|unitId)$/.test(key ?? ''))) {
    const identity = probe.semanticByExternalId.get(value)
    return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : value
  }
  return value
}
