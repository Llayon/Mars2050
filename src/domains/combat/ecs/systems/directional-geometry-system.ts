import type { BattleAction } from '../../combat.actions'
import { compareEntityExternalIdsForMode } from '../authored-order'
import type { BeamAttackConfig, ConeAttackConfig, LinePierceConfig } from '../../combat.primitives'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { resolveEcsSecondaryHit } from './secondary-hit-system'

export type DirectionalOverride =
  | { kind: 'line_pierce'; config: LinePierceConfig }
  | { kind: 'cone_attack'; config: ConeAttackConfig }
  | { kind: 'beam_attack'; config: BeamAttackConfig }

export function canUseEcsDirectionalGeometry(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
): boolean {
  if (!hasDirectionalGeometry(world, attackerId)) return true
  return world.resources.get('entitySpatial') !== undefined
}

export function applyEcsDirectionalGeometry(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  actions: BattleAction[],
  override?: DirectionalOverride,
): void {
  const weapon = world.stores.weapon.require(attackerId)
  const combat = world.stores.combat.require(attackerId)
  const attacker = world.stores.identity.require(attackerId).id
  const primary = world.stores.identity.require(primaryId).id
  const targets = getDirectionalTargets(world, attackerId, primaryId, override)
  let multiplier: number | undefined
  let emitsAttackIntent = false
  if (override?.kind === 'line_pierce' || weapon.linePierce) {
    multiplier = override?.kind === 'line_pierce' ? override.config.damageMultiplier : weapon.linePierce!.damageMultiplier
    emitsAttackIntent = true
  } else if (override?.kind === 'cone_attack' || weapon.coneAttack) {
    multiplier = override?.kind === 'cone_attack' ? override.config.damageMultiplier : weapon.coneAttack!.damageMultiplier
    actions.push({ unitId: attacker, type: 'cone_attack', targetId: primary, radius: combat.range, value: multiplier })
  } else if (override?.kind === 'beam_attack' || weapon.beamAttack) {
    multiplier = override?.kind === 'beam_attack' ? override.config.damageMultiplier : weapon.beamAttack!.damageMultiplier
    actions.push({ unitId: attacker, type: 'beam_tick', targetId: primary, radius: combat.range, value: multiplier })
  }
  if (!multiplier) return
  for (const targetId of targets) {
    resolveEcsSecondaryHit(
      world,
      attackerId,
      targetId,
      Math.floor(combat.attack * multiplier),
      actions,
      { emitAttackIntent: emitsAttackIntent },
    )
  }
}

function getDirectionalTargets(
  world: CombatWorld,
  attackerId: EntityId,
  primaryId: EntityId,
  override?: DirectionalOverride,
): EntityId[] {
  const weapon = world.stores.weapon.require(attackerId)
  if (!hasDirectionalGeometry(world, attackerId)) return []
  const combat = world.stores.combat.require(attackerId)
  const attacker = world.stores.transform.require(attackerId)
  const primary = world.stores.transform.require(primaryId)
  const candidates = world.resources.require('entitySpatial')
    .query(world, attacker.x, attacker.y, combat.range + 240)
    .filter(candidateId => isCandidate(world, attackerId, primaryId, candidateId))
  const cone = override?.kind === 'cone_attack' ? override.config : weapon.coneAttack
  const line = override?.kind === 'line_pierce' ? override.config : weapon.linePierce
  const beam = override?.kind === 'beam_attack' ? override.config : weapon.beamAttack
  if (cone) {
    const centerAngle = Math.atan2(primary.y - attacker.y, primary.x - attacker.x)
    const maxAngle = cone.angleDeg * Math.PI / 360
    return candidates
      .map(targetId => ({
        targetId,
        distance: getEntityDistance(world, attackerId, targetId),
        angle: getTargetAngle(world, attackerId, targetId),
      }))
      .filter(hit => hit.distance <= combat.range + getTargetRadius(world, hit.targetId))
      .filter(hit => Math.abs(normalizeAngle(hit.angle - centerAngle)) <= maxAngle)
      .sort((left, right) => left.distance - right.distance || compareIds(world, left.targetId, right.targetId))
      .slice(0, cone.maxTargets ?? Number.MAX_SAFE_INTEGER)
      .map(hit => hit.targetId)
  }
  const dx = primary.x - attacker.x
  const dy = primary.y - attacker.y
  const length = Math.hypot(dx, dy)
  if (length <= 0) return []
  const ux = dx / length
  const uy = dy / length
  const limit = line ? length : combat.range
  const width = line?.width ?? beam?.width ?? 0
  const maxTargets = line?.maxTargets ?? beam?.maxTargets
  return candidates
    .map(targetId => ({ targetId, progress: getProgress(world, attackerId, targetId, ux, uy) }))
    .filter(hit => hit.progress > 0 && hit.progress <= limit)
    .filter(hit => getLineDistance(world, attackerId, hit.targetId, ux, uy, hit.progress) <=
      width + getTargetRadius(world, hit.targetId))
    .sort((left, right) => left.progress - right.progress || compareIds(world, left.targetId, right.targetId))
    .slice(0, maxTargets ?? Number.MAX_SAFE_INTEGER)
    .map(hit => hit.targetId)
}

function isCandidate(world: CombatWorld, attackerId: EntityId, primaryId: EntityId, candidateId: EntityId): boolean {
  if (candidateId === attackerId || candidateId === primaryId) return false
  const attacker = world.stores.identity.require(attackerId)
  const candidate = world.stores.identity.require(candidateId)
  if (candidate.team === attacker.team || world.stores.vitality.require(candidateId).isDead) return false
  return !world.stores.transform.require(candidateId).isFlying ||
    world.stores.combat.require(attackerId).canTargetAir === true
}

function hasDirectionalGeometry(world: CombatWorld, attackerId: EntityId): boolean {
  const weapon = world.stores.weapon.require(attackerId)
  return Boolean(weapon.linePierce || weapon.coneAttack || weapon.beamAttack ||
    weapon.abilityPrograms?.some(program => program.groups.some(group => group.effects.some(effect =>
      effect.kind === 'line_pierce' || effect.kind === 'cone_attack' || effect.kind === 'beam_attack'))))
}

function getEntityDistance(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return getDistance(left.x, left.y, right.x, right.y)
}

function getTargetAngle(world: CombatWorld, attackerId: EntityId, targetId: EntityId): number {
  const attacker = world.stores.transform.require(attackerId)
  const target = world.stores.transform.require(targetId)
  return Math.atan2(target.y - attacker.y, target.x - attacker.x)
}

function getTargetRadius(world: CombatWorld, targetId: EntityId): number {
  return getSizeRadius(world.stores.transform.require(targetId).size)
}

function getProgress(world: CombatWorld, attackerId: EntityId, targetId: EntityId, ux: number, uy: number): number {
  const attacker = world.stores.transform.require(attackerId)
  const target = world.stores.transform.require(targetId)
  return (target.x - attacker.x) * ux + (target.y - attacker.y) * uy
}

function getLineDistance(
  world: CombatWorld,
  attackerId: EntityId,
  targetId: EntityId,
  ux: number,
  uy: number,
  progress: number,
): number {
  const attacker = world.stores.transform.require(attackerId)
  const target = world.stores.transform.require(targetId)
  return getDistance(target.x, target.y, attacker.x + ux * progress, attacker.y + uy * progress)
}

function compareIds(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  return compareEntityExternalIdsForMode(world, leftId, rightId)
}

function normalizeAngle(value: number): number {
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}
