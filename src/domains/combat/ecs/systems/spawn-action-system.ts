import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { StatusEffect } from '../../combat.sim.types'
import type { UnitSnapshot } from '../../combat.unit-components'
import type { UnitTypeKey } from '../../combat.types'
import { createRuntimeUnitFromConfig } from '../../combat.unit-factory'
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { isEcsMeleeEngagementReady } from '../movement-positioning'
import {
  getEcsActionCooldown,
  prepareEcsStanceForAction,
  syncEcsModeForAction,
} from './action-setup'
import { syncEcsBurrowForAction } from './emerge-strike-system'

const FACING_TOLERANCE = 0.26

export function canUseEcsSpawnAction(world: CombatWorld, entityId: EntityId): boolean {
  return world.stores.weapon.require(entityId).attackType === 'spawn'
}

export function runEcsSpawnAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
  options: { spawnType?: string; preserveCooldown?: boolean } = {},
): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  if ((weapon.attackType !== 'spawn' && options.spawnType === undefined) ||
      !isEcsMeleeEngagementReady(world, entityId, targetId)) return notActed()
  const targetAngle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(targetAngle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  const previousCooldown = combat.actionCooldown
  if ((!options.preserveCooldown && combat.actionCooldown > 0) ||
      isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    return { acted: true }
  }

  syncEcsModeForAction(world, entityId, actions)
  syncEcsBurrowForAction(world, entityId, actions)
  combat.actionCooldown = getEcsActionCooldown(world, entityId)
  if (isSpawnCapReached(world, entityId)) {
    combat.actionCooldown = Math.min(5, combat.actionCooldownMax)
    actions.push({ unitId: identity.id, type: 'spawn_blocked', value: weapon.spawnCap ?? 0 })
    if (options.preserveCooldown) combat.actionCooldown = previousCooldown
    return { acted: false }
  }

  const spawn = createSpawnedUnit(world, entityId, targetId, context, options.spawnType)
  if (!spawn) {
    if (options.preserveCooldown) combat.actionCooldown = previousCooldown
    return { acted: false }
  }
  world.queueUnitCreation(spawn.unit)
  actions.push({
    unitId: identity.id,
    type: 'spawn',
    toX: spawn.unit.x,
    toY: spawn.unit.y,
    spawnType: spawn.unit.type,
    spawnTeam: identity.team,
    spawnMaxHp: spawn.spawnMaxHp,
    targetId: spawn.unit.id,
  })
  if (options.preserveCooldown) combat.actionCooldown = previousCooldown
  return { acted: true }
}

export function runEcsPeriodicSpawnAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
  spawnType: string,
): RuntimeActionResult {
  return runEcsSpawnAction(world, entityId, targetId, actions, context, {
    spawnType,
    preserveCooldown: true,
  })
}

function createSpawnedUnit(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  context: RuntimeActionContext,
  configuredSpawnType?: string,
): { unit: UnitSnapshot; spawnMaxHp: number } | null {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const weapon = world.stores.weapon.require(entityId)
  const spawnType = configuredSpawnType ?? weapon.spawnType ?? 'turret'
  const spawnConfig = UNIT_TYPES[spawnType as UnitTypeKey]
  const sourceConfig = UNIT_TYPES[identity.type as UnitTypeKey]
  const dx = target.x - transform.x
  const dy = target.y - transform.y
  const magnitude = Math.hypot(dx, dy) || 1
  let x = transform.x + (dx / magnitude) * 40
  let y = transform.y + (dy / magnitude) * 40
  if (x < 0 || x >= FIELD_WIDTH || y < 0 || y >= FIELD_HEIGHT) {
    x = transform.x
    y = transform.y
  }
  const id = world.allocateExternalId('spawn')
  if (!spawnConfig) return null
  const overrides = sourceConfig?.baseStats.spawnOverrides
  const hp = overrides?.hp ?? spawnConfig.baseStats.hp
  const unit = createRuntimeUnitFromConfig({
    id,
    team: identity.team,
    type: spawnType,
    hp,
    attack: overrides?.attack ?? spawnConfig.baseStats.attack,
    isTemporary: overrides?.isTemporary,
    temporaryDuration: overrides?.duration,
    currentAngle: identity.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
    x,
    y,
    summonOwnerId: identity.id,
  })
  return unit ? { unit, spawnMaxHp: hp } : null
}

function isSpawnCapReached(world: CombatWorld, entityId: EntityId): boolean {
  const identity = world.stores.identity.require(entityId)
  const cap = world.stores.weapon.require(entityId).spawnCap
  if (cap === undefined) return false
  return world.getActiveSummons(entityId).length >= cap
}

function isActionBlocked(effects: StatusEffect[]): boolean {
  return effects.some(effect =>
    effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'),
  )
}

function notActed(): RuntimeActionResult {
  return { acted: false }
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
