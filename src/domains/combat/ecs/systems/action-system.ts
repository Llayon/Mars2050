import type { BattleAction } from '../../combat.actions'
import { UNIT_TYPES } from '../../combat.config'
import { actionSystem } from '../../combat.systems'
import { getEffectiveCombatTags } from '../../combat.targeting-score'
import type { RuntimeActionContext, RuntimeActionResult } from '../../combat.runtime'
import type { UnitTypeKey } from '../../combat.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { getEcsEffectiveActionRange } from '../movement-positioning'
import { applyEcsHealing } from './healing-system'

const FACING_TOLERANCE = 0.26

export function runActionSystem(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
  context: RuntimeActionContext,
): RuntimeActionResult {
  const weapon = world.stores.weapon.require(entityId)
  if (weapon.attackType !== 'heal') return runLegacyAction(world, entityId, targetId, actions, context)
  return runHealAction(world, entityId, targetId, actions)
}

function runHealAction(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  actions: BattleAction[],
): RuntimeActionResult {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const targetTransform = world.stores.transform.require(targetId)
  const combat = world.stores.combat.require(entityId)
  const targetVitality = world.stores.vitality.require(targetId)
  const movement = world.stores.movement.require(entityId)
  const status = world.stores.statusControl.require(entityId)
  const targetView = world.getEntity(targetId)
  if (!targetView || !canHealTarget(identity.type, targetView)) return notActed()
  const distance = getDistance(transform.x, transform.y, targetTransform.x, targetTransform.y) -
    getSizeRadius(targetTransform.size) - getSizeRadius(transform.size)
  if (targetVitality.hp >= targetVitality.maxHp || distance > getEcsEffectiveActionRange(world, entityId)) return notActed()
  const angle = Math.atan2(targetTransform.y - transform.y, targetTransform.x - transform.x)
  if (Math.abs(normalizeAngle(angle - transform.currentAngle)) > FACING_TOLERANCE) return notActed()
  if (combat.actionCooldown > 0 || isActionBlocked(status.statusEffects)) return notActed()
  if (!prepareStance(world, entityId, actions)) {
    syncActorView(world, entityId)
    return { acted: true, actorSynchronized: true }
  }

  syncActionModes(world, entityId, actions)
  combat.actionCooldown = getActionCooldown(world, entityId)
  applyEcsHealing(world, entityId, targetId, combat.attack, actions)
  syncActorView(world, entityId)
  world.syncComponentsFromStore(targetId, ['vitality'])
  return { acted: true, actorSynchronized: true }
}

function runLegacyAction(world: CombatWorld, entityId: EntityId, targetId: EntityId, actions: BattleAction[], context: RuntimeActionContext): RuntimeActionResult {
  const unit = world.getEntity(entityId)
  const target = world.getEntity(targetId)
  if (!unit || !target) return notActed()
  return {
    acted: actionSystem(unit, target, world.roster, world.hazards, actions, context.rng, context.tick, context.spatialHash),
    actorSynchronized: false,
  }
}

function canHealTarget(sourceType: string, target: NonNullable<ReturnType<CombatWorld['getEntity']>>): boolean {
  const tags = UNIT_TYPES[sourceType as UnitTypeKey]?.baseStats.healTargetTags
  if (!tags?.length) return true
  const targetTags = new Set(getEffectiveCombatTags(target))
  return tags.some(tag => targetTags.has(tag))
}

function prepareStance(world: CombatWorld, entityId: EntityId, actions: BattleAction[]): boolean {
  const identity = world.stores.identity.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const config = movement.stanceConfig
  if (!config || movement.stanceMode === 'deployed') return true
  const required = Math.max(0, Math.floor(config.deployTicks))
  if (required <= 0) {
    movement.stanceMode = 'deployed'
    movement.stanceTicks = 0
    actions.push({ unitId: identity.id, type: 'stance_change', stanceMode: 'deployed' })
    return true
  }
  movement.stanceTicks = (movement.stanceTicks ?? 0) + 1
  if (movement.stanceTicks >= required) {
    movement.stanceMode = 'deployed'
    movement.stanceTicks = 0
    actions.push({ unitId: identity.id, type: 'stance_change', stanceMode: 'deployed' })
  }
  return false
}

function syncActionModes(world: CombatWorld, entityId: EntityId, actions: BattleAction[]): void {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const mode = movement.modeSwitchConfig
  if (mode && mode.groundForAction !== false && (movement.mobilityMode !== 'ground' || transform.isFlying)) {
    movement.mobilityMode = 'ground'
    transform.isFlying = false
    actions.push({ unitId: identity.id, type: 'mode_change', modeState: 'ground' })
  }
  if (!movement.isBurrowed) return
  movement.isBurrowed = false
  const attackMult = movement.burrowConfig?.emergeAttackMult
  const aoeRadiusAdd = movement.burrowConfig?.emergeAoeRadiusAdd
  if (attackMult || aoeRadiusAdd) {
    weapon.emergeStrikePending = { attackMult, aoeRadiusAdd }
    actions.push({ unitId: identity.id, type: 'emerge_strike', value: attackMult ?? aoeRadiusAdd })
  }
  actions.push({ unitId: identity.id, type: 'burrow_change', value: 0 })
}

function getActionCooldown(world: CombatWorld, entityId: EntityId): number {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const effects = world.stores.statusControl.require(entityId).statusEffects
  const stance = movement.stanceMode === 'deployed' && movement.stanceConfig?.cooldownMultiplier
    ? movement.stanceConfig.cooldownMultiplier
    : 1
  const base = Math.max(1, Math.round(combat.actionCooldownMax * stance))
  let suppression = 0
  for (const effect of effects) {
    if (effect.type !== 'output_suppressed' || effect.duration <= 0 || !effect.value || effect.value <= 0) continue
    suppression += effect.value <= 1 ? effect.value : effect.value / 100
  }
  return Math.max(1, Math.round(base * (1 + Math.min(0.5, suppression))))
}

function isActionBlocked(effects: { type: string; duration: number }[]): boolean {
  return effects.some(effect => effect.duration > 0 && (effect.type === 'emp' || effect.type === 'hacked'))
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
