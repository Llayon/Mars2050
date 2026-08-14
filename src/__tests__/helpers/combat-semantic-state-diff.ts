import { createHash } from 'node:crypto'
import type { EcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { captureStage0 } from './combat-movement-pipeline-probes'
import type { OrderingProbeResult } from './combat-ordering-probes'
import type { Stage0Checkpoint } from './combat-movement-pipeline-types'

export const SEMANTIC_COMPONENT_ORDER = [
  'transform',
  'vitality',
  'combat',
  'movement',
  'targeting',
  'entityTargets',
  'statusControl',
  'weapon',
  'runtimeRules',
] as const

type SemanticComponent = typeof SEMANTIC_COMPONENT_ORDER[number]
type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue }

export interface SemanticEntityIdMapping {
  semanticActor: string
  internalEntityId: number | null
}

export interface FirstSemanticStateDivergence {
  semanticActor: string
  component: string
  fieldPath: string
  baselineValue: unknown
  candidateValue: unknown
}

export interface SemanticStateComparison {
  equivalent: boolean
  baselineHash: string
  candidateHash: string
  firstSemanticStateDivergence: FirstSemanticStateDivergence | null
}

export function captureSemanticStateSnapshot(
  runtime: EcsCombatRuntime,
  probe: OrderingProbeResult,
): Stage0Checkpoint {
  return structuredClone(captureStage0(runtime, probe))
}

export function captureSemanticEntityIdMapping(
  runtime: EcsCombatRuntime,
  probe: OrderingProbeResult,
): SemanticEntityIdMapping[] {
  return [...probe.semanticByExternalId.entries()]
    .map(([externalId, identity]) => ({
      semanticActor: semanticIdentityKey(identity),
      internalEntityId: runtime.world.getEntityId(externalId) ?? null,
    }))
    .sort((left, right) => compareCodeUnit(left.semanticActor, right.semanticActor))
}

export function compareSemanticEntityIdMappings(
  left: readonly SemanticEntityIdMapping[],
  right: readonly SemanticEntityIdMapping[],
): boolean {
  return deepEqual(canonicalize(left), canonicalize(right))
}

export function compareSemanticStates(
  baseline: Stage0Checkpoint,
  candidate: Stage0Checkpoint,
): SemanticStateComparison {
  const baselineCanonical = canonicalSemanticState(baseline)
  const candidateCanonical = canonicalSemanticState(candidate)
  return {
    equivalent: deepEqual(baselineCanonical, candidateCanonical),
    baselineHash: hashCanonical(baselineCanonical),
    candidateHash: hashCanonical(candidateCanonical),
    firstSemanticStateDivergence: findFirstDivergence(baseline, candidate),
  }
}

export function canonicalSemanticState(snapshot: Stage0Checkpoint): CanonicalValue {
  const entities = [...snapshot.entities]
    .sort((left, right) => compareCodeUnit(left.semanticActor, right.semanticActor))
    .map(entity => {
      const projected: Record<string, unknown> = { semanticActor: entity.semanticActor }
      for (const component of SEMANTIC_COMPONENT_ORDER) projected[component] = entity[component]
      return projected
    })
  return canonicalize({
    entities,
    clock: snapshot.clock,
    obstacles: snapshot.obstacles,
    dirtyEntities: snapshot.dirtyEntities,
  })
}

export function canonicalize(value: unknown): CanonicalValue {
  if (value === undefined) return { $undefined: true }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_SEMANTIC_STATE')
    return value
  }
  if (Array.isArray(value)) return value.map(item => canonicalize(item))
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const result: { [key: string]: CanonicalValue } = {}
    for (const key of Object.keys(record).sort(compareCodeUnit)) result[key] = canonicalize(record[key])
    return result
  }
  throw new Error(`UNSUPPORTED_SEMANTIC_STATE_VALUE:${typeof value}`)
}

export function canonicalSerialize(value: unknown): string {
  const rendered = JSON.stringify(canonicalize(value))
  if (rendered === undefined) throw new Error('EMPTY_CANONICAL_SEMANTIC_STATE')
  return rendered
}

function findFirstDivergence(
  baseline: Stage0Checkpoint,
  candidate: Stage0Checkpoint,
): FirstSemanticStateDivergence | null {
  const baselineByActor = new Map(baseline.entities.map(entity => [entity.semanticActor, entity]))
  const candidateByActor = new Map(candidate.entities.map(entity => [entity.semanticActor, entity]))
  const actors = [...new Set([...baselineByActor.keys(), ...candidateByActor.keys()])].sort(compareCodeUnit)
  for (const semanticActor of actors) {
    const baselineEntity = baselineByActor.get(semanticActor)
    const candidateEntity = candidateByActor.get(semanticActor)
    if (!baselineEntity || !candidateEntity) {
      return {
        semanticActor,
        component: 'entity',
        fieldPath: 'missing',
        baselineValue: baselineEntity ?? null,
        candidateValue: candidateEntity ?? null,
      }
    }
    for (const component of SEMANTIC_COMPONENT_ORDER) {
      const difference = findValueDifference(baselineEntity[component], candidateEntity[component])
      if (difference) {
        return {
          semanticActor,
          component,
          fieldPath: difference.fieldPath,
          baselineValue: difference.baselineValue,
          candidateValue: difference.candidateValue,
        }
      }
    }
  }
  const worldFields: readonly [string, unknown, unknown][] = [
    ['clock', baseline.clock, candidate.clock],
    ['obstacles', baseline.obstacles, candidate.obstacles],
    ['dirtyEntities', baseline.dirtyEntities, candidate.dirtyEntities],
  ]
  for (const [fieldPath, baselineValue, candidateValue] of worldFields) {
    const difference = findValueDifference(baselineValue, candidateValue)
    if (difference) return {
      semanticActor: '$world',
      component: 'resources',
      fieldPath: `${fieldPath}${difference.fieldPath ? `.${difference.fieldPath}` : ''}`,
      baselineValue: difference.baselineValue,
      candidateValue: difference.candidateValue,
    }
  }
  return null
}

function findValueDifference(
  baselineValue: unknown,
  candidateValue: unknown,
  fieldPath = '',
): { fieldPath: string; baselineValue: unknown; candidateValue: unknown } | null {
  if (Object.is(baselineValue, candidateValue)) return null
  if (Array.isArray(baselineValue) && Array.isArray(candidateValue)) {
    const length = Math.max(baselineValue.length, candidateValue.length)
    for (let index = 0; index < length; index++) {
      const difference = findValueDifference(baselineValue[index], candidateValue[index], `${fieldPath}[${index}]`)
      if (difference) return difference
    }
    return { fieldPath, baselineValue, candidateValue }
  }
  if (isRecord(baselineValue) && isRecord(candidateValue)) {
    const keys = [...new Set([...Object.keys(baselineValue), ...Object.keys(candidateValue)])].sort(compareCodeUnit)
    for (const key of keys) {
      const difference = findValueDifference(baselineValue[key], candidateValue[key], fieldPath ? `${fieldPath}.${key}` : key)
      if (difference) return difference
    }
    return { fieldPath, baselineValue, candidateValue }
  }
  return { fieldPath, baselineValue, candidateValue }
}

function hashCanonical(value: CanonicalValue): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase()
}

function deepEqual(left: CanonicalValue, right: CanonicalValue): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => deepEqual(value, right[index]!))
  }
  if (!isCanonicalRecord(left) || !isCanonicalRecord(right)) return false
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false
  return leftKeys.every(key => deepEqual(left[key]!, right[key]!))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCanonicalRecord(value: CanonicalValue): value is { [key: string]: CanonicalValue } {
  return isRecord(value)
}

function semanticIdentityKey(identity: { originalRole: string; originalRowId: string; memberOrdinal: number }): string {
  return `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}`
}

function compareCodeUnit(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0 }
