import type { BattleAction } from '../../combat.actions'
import { HARMFUL_STATUS_TYPES } from '../../combat.status-core'
import type {
  FieldEffectConfig,
  HazardKind,
  StatusType,
  TriggerPayload,
} from '../../combat.sim.types'
import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

const CLEANSE_HAZARDS: HazardKind[] = [
  'napalm',
  'acid',
  'emp',
  'emp_field',
  'radiation',
  'smoke',
]
type FieldPayload = Extract<TriggerPayload, { kind: 'field' }>

export function applyEcsTriggerField(
  world: CombatWorld,
  ownerId: EntityId,
  anchorId: EntityId,
  payload: FieldPayload,
  actions: BattleAction[],
): void {
  const effect = payload.field
  const anchor = world.stores.transform.require(anchorId)
  const tick = world.resources.get('clock')?.tick ?? 0
  const suffix = `trigger_${tick}_${actions.length}`
  applyEcsFieldEffectAt(world, ownerId, anchor, effect, actions, suffix)
}

export function applyEcsFieldEffectAt(
  world: CombatWorld,
  ownerId: EntityId,
  anchor: { x: number; y: number },
  effect: FieldEffectConfig,
  actions: BattleAction[],
  suffix: string,
): void {
  const owner = world.stores.identity.require(ownerId)
  actions.push({
    unitId: owner.id,
    type: 'field_effect',
    statusType: effect.kind,
    radius: effect.radius,
  })

  if (effect.kind === 'barrier_dome') {
    createBarrier(world, ownerId, anchor, effect, suffix, actions)
  } else if (effect.kind === 'cleanse_field') {
    cleanseHazards(world, ownerId, effect, actions)
    cleanseAllies(world, ownerId, effect.radius, actions)
  } else {
    world.queueHazardCreation({
      id: world.preferExternalId(`field_${owner.id}_${effect.id}_${suffix}`),
      team: owner.team,
      type: effect.hazardType ?? 'smoke',
      x: anchor.x,
      y: anchor.y,
      radius: effect.radius,
      damagePerTick: effect.damagePerTick ?? 0,
      duration: effect.duration ?? effect.intervalTicks,
      statusEffects: effect.statusEffects?.map(status => ({ ...status })),
    })
  }
}

function createBarrier(
  world: CombatWorld,
  ownerId: EntityId,
  anchor: { x: number; y: number },
  effect: FieldEffectConfig,
  suffix: string,
  actions: BattleAction[],
): void {
  const owner = world.stores.identity.require(ownerId)
  const capacity = effect.capacity === undefined
    ? undefined
    : Math.max(1, Math.floor(effect.capacity))
  const hazardId = world.preferExternalId(`barrier_${owner.id}_${effect.id}_${suffix}`)
  world.queueHazardCreation({
    id: hazardId,
    team: owner.team,
    type: 'barrier_dome',
    x: anchor.x,
    y: anchor.y,
    radius: effect.radius,
    damagePerTick: 0,
    duration: effect.duration ?? effect.intervalTicks,
    damageReduction: capacity === undefined
      ? Math.max(0, Math.min(0.95, effect.value ?? 0.35))
      : undefined,
    capacity,
    maxCapacity: capacity,
    sourceUnitId: owner.id,
  })
  if (capacity !== undefined) {
    actions.push({
      unitId: owner.id,
      type: 'barrier_spawn',
      hazardId,
      radius: effect.radius,
      damage: capacity,
    })
  }
}

function cleanseHazards(
  world: CombatWorld,
  ownerId: EntityId,
  effect: FieldEffectConfig,
  actions: BattleAction[],
): void {
  const owner = world.stores.identity.require(ownerId)
  const source = world.stores.transform.require(ownerId)
  const removable = new Set(effect.hazardTypes ?? CLEANSE_HAZARDS)
  const hazardIds = world.query(['hazard'], true).reverse()
  for (const hazardId of hazardIds) {
    const hazard = world.stores.hazard.require(hazardId)
    if (!removable.has(hazard.type) ||
        getDistance(source.x, source.y, hazard.x, hazard.y) > effect.radius) continue
    world.removeHazardEntity(hazardId)
    actions.push({
      unitId: owner.id,
      type: 'hazard_cleanse',
      hazardId: hazard.id,
      statusType: hazard.type,
    })
  }
}

function cleanseAllies(
  world: CombatWorld,
  ownerId: EntityId,
  radius: number,
  actions: BattleAction[],
): void {
  const owner = world.stores.identity.require(ownerId)
  const source = world.stores.transform.require(ownerId)
  const allies = world.query(['identity', 'transform', 'statusControl'])
    .filter(entityId => {
      const candidate = world.stores.identity.require(entityId)
      const transform = world.stores.transform.require(entityId)
      return candidate.team === owner.team &&
        getDistance(source.x, source.y, transform.x, transform.y) <= radius
    })
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )
  for (const allyId of allies) {
    cleanseEcsStatuses(world, allyId, HARMFUL_STATUS_TYPES, actions)
  }
}

export function cleanseEcsStatuses(
  world: CombatWorld,
  entityId: EntityId,
  types: readonly StatusType[],
  actions: BattleAction[],
): void {
  const identity = world.stores.identity.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const allowed = new Set(types)
  for (let index = status.statusEffects.length - 1; index >= 0; index--) {
    const effect = status.statusEffects[index]
    if (!allowed.has(effect.type)) continue
    status.statusEffects.splice(index, 1)
    actions.push({
      unitId: identity.id,
      type: 'status_cleanse',
      statusType: effect.type,
    })
  }
  const targeting = world.stores.targeting.require(entityId)
  if (targeting.controlProgress?.breakOnCleanse) {
    const progress = targeting.controlProgress
    targeting.controlProgress = undefined
    actions.push({
      unitId: progress.sourceUnitId,
      type: 'control_break',
      targetId: identity.id,
      value: progress.progress,
    })
  }
}
