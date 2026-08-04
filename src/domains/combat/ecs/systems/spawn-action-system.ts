import type { BattleAction } from '../../combat.actions'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { StatusEffect } from '../../combat.sim.types'
import type { UnitTypeKey } from '../../combat.types'
import { compileUnit } from '../../combat.unit-compiler'
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { UnitEntityBundle } from '../unit-entity-bundle'
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
  world.queueCompiledUnitCreation(spawn.unit)
  const spawnedIdentity = spawn.unit.components.identity
  const spawnedTransform = spawn.unit.components.transform
  actions.push({
    unitId: identity.id,
    type: 'spawn',
    toX: spawnedTransform.x,
    toY: spawnedTransform.y,
    spawnType: spawnedIdentity.type,
    spawnTeam: identity.team,
    spawnMaxHp: spawn.spawnMaxHp,
    targetId: spawnedIdentity.id,
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
): { unit: UnitEntityBundle; spawnMaxHp: number } | null {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const weapon = world.stores.weapon.require(entityId)
  const spawnType = configuredSpawnType ?? weapon.spawnType ?? 'turret'
  const overrides = world.stores.runtimeRules.require(entityId).spawnOverrides
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
  const unit = compileUnit({
    definitionId: spawnType as UnitTypeKey,
    identity: {
      id,
      team: identity.team,
      summonOwnerId: identity.id,
    },
    loadout: { rank: 1, upgradeIds: [] },
    placement: {
      x,
      y,
      angle: identity.team === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
    },
    spawn: { inheritance: 'base' },
    overrides: {
      maxHp: overrides?.hp,
      attack: overrides?.attack,
      isTemporary: overrides?.isTemporary,
      temporaryDuration: overrides?.duration,
    },
  })
  return unit
    ? { unit, spawnMaxHp: unit.components.vitality.maxHp }
    : null
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
