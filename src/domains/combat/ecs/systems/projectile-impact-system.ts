import type { RuntimePhaseContext } from '../../combat.phase'
import type { BattleAction } from '../../combat.actions'
import type { Team } from '../../combat.sim.types'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { PendingImpact } from '../pending-impacts'
import { commitActionGroup } from './actor-turn-system'
import { applyEcsSingleDamage } from './damage-system'
import { allocateTemporalInterceptions, type TemporalImpactPoint } from './damage-interception-system'
import { runCompiledAbilityTrigger } from './ability-effect-system'
import { resolveEcsDeath } from './death-system'

/** Resolves launched impacts transactionally after movement and timeline launch. */
export function runProjectileImpactSystem(world: CombatWorld, context: RuntimePhaseContext): void {
  const impacts = world.resources.require('pendingImpacts').take(context.tick)
  if (impacts.length === 0) return
  for (const impact of impacts) {
    if (impact.positionPolicy !== 'tracked_target') continue
    if (resolveImpactPoint(world, impact) !== null) continue
    context.actions.push({
      unitId: impact.sourceExternalId,
      type: 'projectile_miss',
      impactId: impact.id,
      impactTick: impact.impactTick,
      toX: impact.targetX,
      toY: impact.targetY,
    })
  }
  const points = impacts
    .map(impact => resolveImpactPoint(world, impact))
    .filter((point): point is TemporalImpactPoint => point !== null)
  const allocation = allocateTemporalInterceptions(world, points)
  for (const entityId of allocation.cooldownEntities) {
    const defense = world.stores.defense.require(entityId)
    defense.projectileInterceptCooldown = defense.projectileInterceptCooldownMax ?? 0
  }
  const ledger = world.resources.get('actionGroup')
  if (!ledger) return
  const entities = world.query(['identity', 'vitality'])
  ledger.begin(world, entities)
  for (const point of points) {
    const { impact, x, y } = point
    const targetId = impact.payload.kind === 'direct' ? impact.payload.targetId ?? impact.targetId : undefined
    const targetAlive = targetId !== undefined && Boolean(world.stores.vitality.get(targetId) && !world.stores.vitality.require(targetId).isDead)
    const interceptorId = allocation.byImpact.get(impact.id)
    if (interceptorId !== undefined) {
      const targetExternalId = targetId !== undefined && world.stores.identity.get(targetId)
        ? world.stores.identity.require(targetId).id
        : undefined
      const source = world.stores.transform.get(impact.sourceId)
      context.actions.push({
        unitId: world.stores.identity.require(interceptorId).id,
        type: 'projectile_intercept',
        targetId: targetExternalId,
        impactId: impact.id,
        damage: impact.interceptionDamage,
        fromX: source?.x,
        fromY: source?.y,
        toX: x,
        toY: y,
      })
      continue
    }
    if (impact.positionPolicy === 'tracked_target' && !targetAlive) {
      context.actions.push({ unitId: impact.sourceExternalId, type: 'projectile_miss', impactId: impact.id, impactTick: impact.impactTick, toX: impact.targetX, toY: impact.targetY })
      continue
    }
    context.actions.push({
      unitId: impact.sourceExternalId,
      type: 'projectile_impact',
      targetId: targetAlive ? world.stores.identity.require(targetId!).id : undefined,
      impactId: impact.id,
      impactTick: impact.impactTick,
      toX: x,
      toY: y,
    })
    if (impact.payload.kind === 'direct') {
      if (!targetAlive) continue
      const handledDamage = impact.programs?.length
        ? runCompiledAbilityTrigger(world, impact.sourceId, targetId!, 'projectile_impact', context.actions, { x, y })
        : false
      if (!handledDamage && impact.payload.damage > 0) {
        applyEcsSingleDamage(world, impact.sourceId, targetId!, impact.payload.damage, context.actions, { interceptable: false })
      }
      continue
    }
    applyAreaDamage(world, impact, x, y, context.actions)
  }
  commitActionGroup(world, ledger, context.actions)
  for (const entityId of entities) {
    const vitality = world.stores.vitality.require(entityId)
    if (vitality.hp <= 0 && !vitality.isDead) resolveEcsDeath(world, entityId, undefined, context.actions, 'weapon')
  }
  ledger.finish()
}

function resolveImpactPoint(world: CombatWorld, impact: PendingImpact): TemporalImpactPoint | null {
  if (impact.positionPolicy === 'tracked_target') {
    const targetId = impact.payload.kind === 'direct' ? impact.payload.targetId ?? impact.targetId : impact.targetId
    if (targetId === undefined) return null
    const target = world.stores.transform.get(targetId)
    if (!target || world.stores.vitality.require(targetId).isDead) return null
    return { impact, x: target.x, y: target.y }
  }
  return { impact, x: impact.targetX, y: impact.targetY }
}

function applyAreaDamage(
  world: CombatWorld,
  impact: PendingImpact,
  x: number,
  y: number,
  actions: BattleAction[],
): void {
  if (impact.payload.kind !== 'area') return
  const { damage, radius, maxTargets } = impact.payload
  const spatial = world.resources.require('entitySpatial')
  const candidates = spatial.query(world, x, y, radius + getSizeRadius('XL'))
    .filter(targetId => {
      const identity = world.stores.identity.get(targetId)
      const vitality = world.stores.vitality.get(targetId)
      const transform = world.stores.transform.get(targetId)
      if (!identity || !vitality || !transform || identity.team === impact.sourceTeam || vitality.isDead) return false
      return getDistance(x, y, transform.x, transform.y) <= radius + getSizeRadius(transform.size)
    })
    .sort((left, right) => {
      const leftTransform = world.stores.transform.require(left)
      const rightTransform = world.stores.transform.require(right)
      return getDistance(x, y, leftTransform.x, leftTransform.y) - getDistance(x, y, rightTransform.x, rightTransform.y) ||
        world.stores.identity.require(left).id.localeCompare(world.stores.identity.require(right).id)
    })
    .slice(0, maxTargets ?? Number.MAX_SAFE_INTEGER)
  for (const targetId of candidates) {
    applyEcsSingleDamage(world, impact.sourceId, targetId, damage, actions, { interceptable: false })
  }
}
