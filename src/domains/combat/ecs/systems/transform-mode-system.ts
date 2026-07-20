import type { BattleAction } from '../../combat.actions'
import type { TransformModeConfig } from '../../combat.sim.types'
import { FIELD_HEIGHT } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function getEcsTransformModeEntities(world: CombatWorld): EntityId[] {
  return world.query([
    'identity',
    'transform',
    'vitality',
    'combat',
    'weapon',
    'statusControl',
  ]).filter(entityId =>
    Boolean(world.stores.statusControl.require(entityId).transformMode),
  )
}

export function runEcsTransformModeSystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsTransformModeEntities(world),
): void {
  const ordered = [...entityIds].sort((left, right) =>
    world.stores.identity.require(left).id.localeCompare(
      world.stores.identity.require(right).id,
    ),
  )
  for (const entityId of ordered) {
    const vitality = world.stores.vitality.require(entityId)
    if (vitality.isDead) continue
    const status = world.stores.statusControl.require(entityId)
    for (const mode of status.transformMode ?? []) {
      if (status.transformState?.appliedIds.includes(mode.id)) continue
      if (mode.trigger === 'battle_start' && tick === 0) {
        applyTransformMode(world, entityId, mode, actions)
      }
      if (mode.trigger === 'hp_threshold' && isHpThresholdMet(world, entityId, mode)) {
        applyTransformMode(world, entityId, mode, actions)
      }
    }
  }
}

function isHpThresholdMet(
  world: CombatWorld,
  entityId: EntityId,
  mode: TransformModeConfig,
): boolean {
  const vitality = world.stores.vitality.require(entityId)
  const threshold = mode.hpThreshold ?? 0
  const value = threshold <= 1 ? vitality.hp / vitality.maxHp : vitality.hp
  return value <= threshold
}

function applyTransformMode(
  world: CombatWorld,
  entityId: EntityId,
  mode: TransformModeConfig,
  actions: BattleAction[],
): void {
  const status = world.stores.statusControl.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const transform = world.stores.transform.require(entityId)
  status.transformState ??= { appliedIds: [] }
  status.transformState.appliedIds.push(mode.id)

  if (mode.hpMult !== undefined && mode.hpMult > 0) {
    const oldMax = vitality.maxHp
    vitality.maxHp = Math.max(1, Math.floor(vitality.maxHp * mode.hpMult))
    vitality.hp = Math.max(1, Math.floor(vitality.hp * (vitality.maxHp / oldMax)))
  }
  if (mode.attackMult !== undefined && mode.attackMult > 0) {
    combat.attack = Math.max(0, Math.floor(combat.attack * mode.attackMult))
  }
  if (mode.speedMult !== undefined && mode.speedMult >= 0) combat.speed *= mode.speedMult
  if (mode.rangeMult !== undefined && mode.rangeMult > 0) combat.range *= mode.rangeMult
  if (mode.cooldownMult !== undefined && mode.cooldownMult > 0) {
    combat.actionCooldownMax = Math.max(
      1,
      Math.round(combat.actionCooldownMax * mode.cooldownMult),
    )
  }
  if (mode.aoeRadiusAdd !== undefined && mode.aoeRadiusAdd > 0) {
    weapon.attackType = 'aoe'
    weapon.aoeRadius = (weapon.aoeRadius ?? 0) + mode.aoeRadiusAdd
  }
  if (mode.isFlying !== undefined) transform.isFlying = mode.isFlying
  if (mode.canTargetAir !== undefined) combat.canTargetAir = mode.canTargetAir
  if (mode.mode === 'jump' && mode.jumpDistance) {
    const team = world.stores.identity.require(entityId).team
    const direction = team === 'attacker' ? -1 : 1
    transform.y = Math.max(
      0,
      Math.min(FIELD_HEIGHT, transform.y + direction * mode.jumpDistance),
    )
    world.syncEntitySpatialPosition(entityId)
  }

  actions.push({
    unitId: world.stores.identity.require(entityId).id,
    type: 'transform_mode',
    modeState: mode.mode,
    value: vitality.hp,
  })
}
