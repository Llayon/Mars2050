import type { BattleAction } from '../../combat.actions'
import { chooseHackControlMode } from '../../combat.control-mode'
import type { RuntimeStatusEffect } from '../../combat.primitives'
import { getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRangeAgainst, isEcsMeleeEngagementReady } from '../movement-positioning'

const FACING_TOLERANCE = 0.26

export type EcsWeaponPreparation =
  | { state: 'not_ready' }
  | { state: 'setup_in_progress' }
  | { state: 'ready' }

export function prepareEcsWeaponAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  options: { requireFacing?: boolean } = {},
): EcsWeaponPreparation {
  const source = world.stores.transform.require(entityId)
  const target = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const edgeDistance = Math.hypot(target.x - source.x, target.y - source.y) -
    getSizeRadius(target.size) - getSizeRadius(source.size)
  if (!isEcsWeaponActionInRange(world, entityId, targetId, edgeDistance)) {
    return { state: 'not_ready' }
  }
  const targetAngle = Math.atan2(target.y - source.y, target.x - source.x)
  if ((options.requireFacing !== false && Math.abs(normalizeAngle(targetAngle - source.currentAngle)) > FACING_TOLERANCE) ||
      combat.actionCooldown > 0 || isEcsAttackBlocked(status.statusEffects, combat.attack)) {
    return { state: 'not_ready' }
  }
  if (!prepareEcsStanceForAction(world, entityId, actions)) {
    return { state: 'setup_in_progress' }
  }
  return { state: 'ready' }
}

export function isEcsWeaponActionInRange(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  edgeDistance: number,
): boolean {
  const minimumRange = getEcsMinimumActionRange(world, entityId)
  return (minimumRange <= 0 || edgeDistance >= minimumRange) &&
    edgeDistance <= getEcsStanceSetupActionRange(world, entityId, targetId) &&
    isEcsMeleeEngagementReady(world, entityId, targetId)
}

export function getEcsStanceSetupActionRange(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
): number {
  const range = getEcsEffectiveActionRangeAgainst(world, entityId, targetId)
  const movement = world.stores.movement.require(entityId)
  if (!movement.stanceConfig || movement.stanceMode === 'deployed') return range
  return range * getPositiveMultiplier(movement.stanceConfig.rangeMultiplier, 1)
}

export function prepareEcsStanceForAction(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
): boolean {
  const identity = world.stores.identity.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const config = movement.stanceConfig
  if (!config || movement.stanceMode === 'deployed') return true
  const required = Math.max(0, Math.floor(config.deployTicks))
  if (required <= 0) {
    setDeployed(identity.id, movement, actions)
    return true
  }
  movement.stanceTicks = (movement.stanceTicks ?? 0) + 1
  if (movement.stanceTicks >= required) setDeployed(identity.id, movement, actions)
  return false
}

export function getEcsActionCooldown(world: CombatWorld, entityId: EntityId): number {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const effects = world.stores.statusControl.require(entityId).statusEffects
  const stance = movement.stanceMode === 'deployed'
    ? getPositiveMultiplier(movement.stanceConfig?.cooldownMultiplier, 1)
    : 1
  const base = Math.max(1, Math.round(combat.actionCooldownMax * stance))
  let suppression = 0
  for (const effect of effects) {
    if (effect.type !== 'output_suppressed' || effect.duration <= 0 ||
        !effect.value || effect.value <= 0) continue
    suppression += effect.value <= 1 ? effect.value : effect.value / 100
  }
  return Math.max(1, Math.round(base * (1 + Math.min(0.5, suppression))))
}

export function syncEcsModeForAction(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
): void {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const config = movement.modeSwitchConfig
  if (!config || config.groundForAction === false ||
      (movement.mobilityMode === 'ground' && !transform.isFlying)) return
  movement.mobilityMode = 'ground'
  transform.isFlying = false
  actions.push({ unitId: identity.id, type: 'mode_change', modeState: 'ground' })
}

function getEcsMinimumActionRange(world: CombatWorld, entityId: EntityId): number {
  return world.stores.runtimeRules.require(entityId).minimumRange
}

function isEcsAttackBlocked(effects: RuntimeStatusEffect[], attack: number): boolean {
  let hackMode: ReturnType<typeof chooseHackControlMode> | undefined
  for (const effect of effects) {
    if (effect.duration <= 0) continue
    if (effect.type === 'emp') return true
    if (effect.type === 'hacked') {
      hackMode = chooseHackControlMode(hackMode, effect.controlMode ?? 'disable')
    }
  }
  return hackMode === 'disable' || (hackMode !== undefined && attack <= 0)
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}


function setDeployed(
  externalId: string,
  movement: ReturnType<CombatWorld['stores']['movement']['require']>,
  actions: BattleAction[],
): void {
  if (movement.stanceMode === 'deployed') return
  movement.stanceMode = 'deployed'
  movement.stanceTicks = 0
  actions.push({ unitId: externalId, type: 'stance_change', stanceMode: 'deployed' })
}

function getPositiveMultiplier(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}
