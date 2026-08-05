import type { RuntimePhaseContext } from '../../combat.phase'
import { getDistance, getSizeRadius } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { PendingImpact } from '../pending-impacts'
import { commitActionGroup } from './actor-turn-system'
import { allocateTemporalInterceptions, type TemporalImpactPoint } from './damage-interception-system'
import { executeCapturedImpactPrograms, freezeImpactTargets } from './temporal-impact-ability-system'

/** Resolves launched impacts transactionally after movement and timeline launch. */
export function runProjectileImpactSystem(world: CombatWorld, context: RuntimePhaseContext): void {
  const impacts = world.resources.require('pendingImpacts').take(context.tick)
  if (impacts.length === 0) return
  const points: TemporalImpactPoint[] = []
  for (const impact of impacts) {
    const point = resolveImpactPoint(world, impact)
    if (point) points.push(point)
    else context.actions.push({ unitId: impact.sourceExternalId, type: 'projectile_miss', impactId: impact.id, impactTick: impact.impactTick, toX: impact.targetX, toY: impact.targetY })
  }
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
    const targetValid = targetId !== undefined && isDirectTargetValid(world, impact, targetId, x, y)
    const interceptorId = allocation.byImpact.get(impact.id)
    if (interceptorId !== undefined) {
      const targetExternalId = targetId !== undefined && world.stores.identity.get(targetId)
        ? world.stores.identity.require(targetId).id
        : undefined
      const sourceId = impact.sourceContext?.attribution.sourceEntityId ?? impact.sourceId
      const source = world.stores.transform.get(sourceId)
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
    if (impact.payload.kind === 'direct' && !targetValid) {
      context.actions.push({ unitId: impact.sourceExternalId, type: 'projectile_miss', impactId: impact.id, impactTick: impact.impactTick, toX: impact.targetX, toY: impact.targetY })
      continue
    }
    context.actions.push({
      unitId: impact.sourceExternalId,
      type: 'projectile_impact',
      targetId: targetValid ? world.stores.identity.require(targetId!).id : undefined,
      impactId: impact.id,
      impactTick: impact.impactTick,
      toX: x,
      toY: y,
    })
    const frozen = freezeImpactTargets(world, impact, x, y)
    executeCapturedImpactPrograms(world, impact, frozen, { x, y }, context.actions)
  }
  commitActionGroup(world, ledger, context.actions)
  ledger.finish()
}

function isDirectTargetValid(world: CombatWorld, impact: PendingImpact, targetId: number, x: number, y: number): boolean {
  const identity = world.stores.identity.get(targetId)
  const vitality = world.stores.vitality.get(targetId)
  const transform = world.stores.transform.get(targetId)
  if (!identity || !vitality || !transform || vitality.isDead) return false
  if (identity.team !== (impact.hostileTeamAtLaunch ?? impact.targetTeam)) return false
  if (transform.isFlying && impact.canTargetAir === false) return false
  if (!transform.isFlying && impact.canTargetGround === false) return false
  if (impact.positionPolicy === 'captured_at_launch') {
    return getDistance(transform.x, transform.y, x, y) <= getSizeRadius(transform.size)
  }
  return true
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
