import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import { getEcsInitiativeGroups } from '@/domains/combat/ecs/systems/initiative-system'
import {
  createEcsMeleeEngagementState,
  reserveEcsMeleeSlot,
} from '@/domains/combat/ecs/systems/melee-engagement-system'
import { runTargetingSystem } from '@/domains/combat/ecs/systems/targeting-system'
import { PRNG } from '@/domains/combat/combat.utils'
import type { OrderingProbeResult, SemanticOrderingIdentity } from './combat-ordering-probes'

export interface InitialPlanningRecord {
  semanticActor: string
  speed: number
  groupOrdinal: number
  processingOrdinal: number
  semanticTarget: string | null
  isMelee: boolean
  reservationAttempted: boolean
  reservationSucceeded: boolean | null
  meleeSlotIndex: number | null
  semanticWaitingTarget: string | null
  disposition: 'reserved' | 'waiting' | 'not_melee' | 'no_target'
}

export interface InitialPlanningSnapshot {
  records: InitialPlanningRecord[]
}

export interface PlanningDivergence {
  group: number
  ordinal: number
  semanticActor: string
  field: string
  baselineValue: string | number | boolean | null
  candidateValue: string | number | boolean | null
}

/**
 * Replays the initial actor-turn targeting and reservation prefix in a test-only world.
 *
 * @param probe Transformed rows and semantic mapping.
 * @param seed Deterministic squad compilation seed.
 * @returns Semantic actor processing, target, and reservation records.
 */
export function captureInitialPlanningSnapshot(
  probe: OrderingProbeResult,
  seed: number,
): InitialPlanningSnapshot {
  const runtime = createEcsCombatRuntime()
  const rng = new PRNG(seed)
  for (const row of probe.attackers) runtime.addSquad(row, 'attacker', rng)
  for (const row of probe.defenders) runtime.addSquad(row, 'defender', rng)
  runtime.flushStructuralCommands()
  const world = runtime.world
  world.resources.require('entitySpatial').ensureCurrent(world)
  const targeting = world.resources.require('targetingRuntime')
  const melee = createEcsMeleeEngagementState()
  const records: InitialPlanningRecord[] = []
  targeting.begin(world)
  try {
    getEcsInitiativeGroups(world).forEach((group, groupOrdinal) => {
      group.entityIds.forEach((entityId, processingOrdinal) => {
        const identity = world.stores.identity.require(entityId)
        const semanticActor = semanticId(identity.id, probe.semanticByExternalId)
        const targetId = runTargetingSystem(world, entityId, melee, targeting)
        const isMelee = world.stores.combat.require(entityId).range <= 60
        const canReserve = isMelee && targetId !== null && canActOnTarget(world, entityId, targetId)
        const reservationAttempted = canReserve
        const reservationSucceeded = canReserve ? reserveEcsMeleeSlot(world, entityId, targetId, melee) : null
        const refs = world.stores.entityTargets.require(entityId)
        const targetingState = world.stores.targeting.require(entityId)
        const semanticWaitingTarget = refs.meleeWaitingTarget === undefined
          ? null
          : semanticId(world.stores.identity.require(refs.meleeWaitingTarget).id, probe.semanticByExternalId)
        const disposition = !isMelee
          ? 'not_melee'
          : targetId === null
            ? 'no_target'
            : reservationSucceeded
              ? 'reserved'
              : 'waiting'
        records.push({
          semanticActor,
          speed: group.speed,
          groupOrdinal,
          processingOrdinal,
          semanticTarget: targetId === null ? null : semanticId(world.stores.identity.require(targetId).id, probe.semanticByExternalId),
          isMelee,
          reservationAttempted,
          reservationSucceeded,
          meleeSlotIndex: targetingState.meleeSlotIndex ?? null,
          semanticWaitingTarget,
          disposition,
        })
      })
    })
  } finally {
    targeting.end()
  }
  return { records }
}

export function firstPlanningDivergence(
  baseline: InitialPlanningSnapshot,
  candidate: InitialPlanningSnapshot,
): PlanningDivergence | null {
  const count = Math.max(baseline.records.length, candidate.records.length)
  const fields: (keyof InitialPlanningRecord)[] = [
    'semanticActor', 'semanticTarget', 'reservationSucceeded', 'meleeSlotIndex', 'semanticWaitingTarget', 'disposition',
  ]
  for (let index = 0; index < count; index++) {
    const left = baseline.records[index]
    const right = candidate.records[index]
    if (!left || !right) return planningDivergence(left ?? right, 'record', left ? stringify(right) : stringify(left))
    for (const field of fields) {
      if (left[field] !== right[field]) {
        return {
          group: right.groupOrdinal,
          ordinal: right.processingOrdinal,
          semanticActor: right.semanticActor,
          field,
          baselineValue: scalar(left[field]),
          candidateValue: scalar(right[field]),
        }
      }
    }
  }
  return null
}

function planningDivergence(
  record: InitialPlanningRecord,
  field: string,
  value: string,
): PlanningDivergence {
  return {
    group: record.groupOrdinal,
    ordinal: record.processingOrdinal,
    semanticActor: record.semanticActor,
    field,
    baselineValue: value,
    candidateValue: value,
  }
}

function scalar(value: InitialPlanningRecord[keyof InitialPlanningRecord]): string | number | boolean | null {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return null
}

function stringify(value: InitialPlanningRecord | undefined): string {
  return value === undefined ? 'missing' : JSON.stringify(value)
}

function semanticId(id: string, mapping: ReadonlyMap<string, SemanticOrderingIdentity>): string {
  const identity = mapping.get(id)
  return identity ? `${identity.originalRole}:${identity.originalRowId}:${identity.memberOrdinal}` : id
}

function canActOnTarget(world: ReturnType<typeof createEcsCombatRuntime>['world'], entityId: number, targetId: number): boolean {
  const source = world.stores.identity.require(entityId)
  const target = world.stores.identity.require(targetId)
  if (source.team !== target.team) return true
  if (world.stores.weapon.require(entityId).attackType === 'heal') return true
  return world.stores.statusControl.require(entityId).statusEffects.some(effect =>
    effect.type === 'hacked' && effect.duration > 0 &&
    (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'),
  )
}
