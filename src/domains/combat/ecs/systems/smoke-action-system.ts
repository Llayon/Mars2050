import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { SimUnit, StatusEffect } from '../../combat.sim.types'
import { FIELD_HEIGHT, FIELD_WIDTH, getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import {
  getEcsActionCooldown,
  isEcsWeaponActionInRange,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup'
import { syncEcsBurrowForAction } from './emerge-strike-system'

const FACING_TOLERANCE = 0.26

export function canUseEcsSmokeAction(world: CombatWorld, entityId: EntityId): boolean {
  return createSmokeStatuses(world.stores.weapon.require(entityId).smokeOnAction).length > 0
}

export function runEcsSmokeAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const config = world.stores.weapon.require(entityId).smokeOnAction
  const statusEffects = createSmokeStatuses(config)
  if (!config || statusEffects.length === 0) return notActed()

  const edgeDistance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(transform.size) - getSizeRadius(targetTransform.size)
  if (!isEcsWeaponActionInRange(world, entityId, targetId, edgeDistance)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0 || isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    return { acted: true, actorSynchronized: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  deploySmoke(world, identity.id, entityId, targetId, config, statusEffects, actions, context)
  return { acted: true, actorSynchronized: true }
}

function deploySmoke(
  world: CombatWorld,
  externalId: string,
  entityId: EntityId,
  targetId: EntityId,
  config: NonNullable<SimUnit['smokeOnAction']>,
  statusEffects: StatusEffect[],
  actions: BattleAction[],
  context: RuntimeActionContext,
): void {
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const range = world.stores.combat.require(entityId).range
  const team = world.stores.identity.require(entityId).team
  const dx = targetTransform.x - transform.x
  const dy = targetTransform.y - transform.y
  const distance = Math.hypot(dx, dy) || 1
  const placementDistance = Math.min(range, Math.max(24, distance * 0.75))
  const x = clamp(transform.x + (dx / distance) * placementDistance, 0, FIELD_WIDTH)
  const y = clamp(transform.y + (dy / distance) * placementDistance, 0, FIELD_HEIGHT)
  const id = `smoke_${Math.floor(context.rng.next() * 1000000)}`

  world.queueHazardCreation({
    id,
    team,
    type: 'smoke',
    x,
    y,
    radius: config.radius,
    damagePerTick: 0,
    duration: config.duration,
    statusEffects,
  })
  actions.push({
    unitId: externalId,
    type: 'hazard_spawn',
    hazardId: id,
    toX: round(x),
    toY: round(y),
    radius: config.radius,
    statusType: 'smoke',
  })
}

function createSmokeStatuses(config: SimUnit['smokeOnAction']): StatusEffect[] {
  if (!config) return []
  const effects: StatusEffect[] = []
  if ((config.rangeSuppression ?? 0) > 0) {
    effects.push({ type: 'range_suppressed', duration: 12, value: config.rangeSuppression })
  }
  if ((config.outputSuppression ?? 0) > 0) {
    effects.push({ type: 'output_suppressed', duration: 12, value: config.outputSuppression })
  }
  if ((config.accuracySuppression ?? 0) > 0) {
    effects.push({ type: 'accuracy_reduced', duration: 12, value: config.accuracySuppression })
  }
  return effects
}

function isActionBlocked(effects: StatusEffect[]): boolean {
  return effects.some(effect =>
    effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'),
  )
}

function notActed(): RuntimeActionResult {
  return { acted: false, actorSynchronized: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
