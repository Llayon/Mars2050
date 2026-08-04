import type { RuntimePhaseContext } from '../../combat.phase'
import type { Team } from '../../combat.sim.types'
import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import { commitActionGroup } from './actor-turn-system'
import { applyEcsSingleDamage } from './damage-system'
import { tryEcsPointInterception } from './damage-interception-system'
import { runCompiledAbilityTrigger } from './ability-effect-system'
import { resolveEcsDeath } from './death-system'

/** Resolves launched impacts transactionally after movement. */
export function runProjectileImpactSystem(world: CombatWorld, context: RuntimePhaseContext): void {
  const queue = world.resources.require('pendingImpacts')
  const impacts = queue.take(context.tick)
  if (impacts.length === 0) return
  const ledger = world.resources.get('actionGroup') ?? undefined
  if (!ledger) return
  const entities = world.query(['identity', 'vitality'])
  ledger.begin(world, entities)
  for (const impact of impacts) {
    const source = world.stores.identity.get(impact.sourceId)
    if (!source) continue
    const targetId = impact.targetId
    const targetAlive = targetId !== undefined && world.stores.vitality.get(targetId) && !world.stores.vitality.require(targetId).isDead
    if (impact.kind === 'projectile' && !targetAlive) {
      context.actions.push({ unitId: impact.sourceExternalId, type: 'projectile_miss', impactId: impact.id, impactTick: impact.impactTick })
      continue
    }
    context.actions.push({ unitId: impact.sourceExternalId, type: 'projectile_impact', targetId: targetAlive ? world.stores.identity.require(targetId!).id : undefined, impactId: impact.id, impactTick: impact.impactTick })
    if (impact.directDamage > 0 && targetAlive && impact.interceptable) {
      const targetTransform = world.stores.transform.require(targetId!)
      if (tryEcsPointInterception(world, impact.sourceId, targetId, targetTransform.x, targetTransform.y, impact.directDamage, context.actions, true)) continue
    }
    if (impact.programs?.length) {
      const impactTarget = targetAlive ? targetId! : impact.sourceId
      const handledDamage = runCompiledAbilityTrigger(world, impact.sourceId, impactTarget, 'projectile_impact', context.actions, { x: impact.targetX, y: impact.targetY })
      if (handledDamage) continue
    }
    if (impact.directDamage > 0 && targetAlive) {
      applyEcsSingleDamage(world, impact.sourceId, targetId!, impact.directDamage, context.actions, { interceptable: false })
    }
    if (impact.areaDamage > 0) applyAreaDamage(world, impact, context.actions)
  }
  commitActionGroup(world, ledger, context.actions)
  for (const entityId of entities) {
    const vitality = world.stores.vitality.require(entityId)
    if (vitality.hp <= 0 && !vitality.isDead) resolveEcsDeath(world, entityId, undefined, context.actions, 'weapon')
  }
  ledger.finish()
}

function applyAreaDamage(world: CombatWorld, impact: { sourceId: number; sourceTeam: Team; targetX: number; targetY: number; areaDamage: number; areaRadius: number }, actions: BattleAction[]): void {
  const spatial = world.resources.require('entitySpatial')
  for (const targetId of spatial.query(world, impact.targetX, impact.targetY, impact.areaRadius)) {
    const identity = world.stores.identity.get(targetId)
    const vitality = world.stores.vitality.get(targetId)
    const transform = world.stores.transform.get(targetId)
    if (!identity || !vitality || !transform || identity.team === impact.sourceTeam || vitality.isDead) continue
    applyEcsSingleDamage(world, impact.sourceId, targetId, impact.areaDamage, actions, { interceptable: false })
  }
}
