import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { StatusEffect } from '../../combat.sim.types'
import type { UnitBaseStats, UnitTypeKey } from '../../combat.types'
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
type MineConfig = NonNullable<UnitBaseStats['mineOnAction']>

export function canUseEcsMineAction(world: CombatWorld, entityId: EntityId): boolean {
  return getMineConfig(world, entityId) !== undefined
}

export function runEcsMineAction(
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
  const config = getMineConfig(world, entityId)
  if (!config) return notActed()

  const edgeDistance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(transform.size) - getSizeRadius(targetTransform.size)
  if (!isEcsWeaponActionInRange(world, entityId, targetId, edgeDistance)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0 || isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    syncActorView(world, entityId)
    return { acted: true, actorSynchronized: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  deployMine(world, identity.id, entityId, targetId, config, actions, context)
  syncActorView(world, entityId)
  return { acted: true, actorSynchronized: true }
}

function deployMine(
  world: CombatWorld,
  externalId: string,
  entityId: EntityId,
  targetId: EntityId,
  config: MineConfig,
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
  const placementDistance = Math.min(range, Math.max(24, distance * 0.65))
  const x = clamp(transform.x + (dx / distance) * placementDistance, 0, FIELD_WIDTH)
  const y = clamp(transform.y + (dy / distance) * placementDistance, 0, FIELD_HEIGHT)
  const id = `mine_${Math.floor(context.rng.next() * 1000000)}`

  world.hazards.push({
    id,
    team,
    type: 'mine',
    x,
    y,
    radius: config.radius,
    damagePerTick: config.damage,
    duration: config.duration,
    sourceUnitId: externalId,
  })
  actions.push({
    unitId: externalId,
    type: 'hazard_spawn',
    hazardId: id,
    toX: round(x),
    toY: round(y),
    radius: config.radius,
  })
}

function getMineConfig(world: CombatWorld, entityId: EntityId): MineConfig | undefined {
  const type = world.stores.identity.require(entityId).type as UnitTypeKey
  return UNIT_TYPES[type]?.baseStats.mineOnAction
}

function isActionBlocked(effects: StatusEffect[]): boolean {
  return effects.some(effect =>
    effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'),
  )
}

function syncActorView(world: CombatWorld, entityId: EntityId): void {
  world.syncComponentsFromStore(entityId, ['transform', 'combat', 'weapon', 'movement'])
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
