import type { RuntimePhaseContext } from '../../combat.phase'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { MovementRequest } from '../movement-batch.types'
import {
  createEcsMeleeEngagementState,
  reserveEcsMeleeSlot,
} from './melee-engagement-system'
import { getEcsTurnOrder } from './initiative-system'
import { runActionSystem } from './action-system'
import { resolveEcsDeath } from './death-system'
import { runModifierSystem } from './modifier-system'
import { runEcsPeriodicSpawnerSystem } from './periodic-spawner-system'
import { runTargetingSystem } from './targeting-system'

export function runEcsActorTurnSystem(
  world: CombatWorld,
  context: RuntimePhaseContext,
): void {
  const rng = context.rng ?? world.resources.require('rng')
  const turnOrder = getEcsTurnOrder(world, context.tick)
  const movementRequests: MovementRequest[] = []
  world.resources.set('movementRequests', movementRequests)
  world.flushStructuralCommands()
  world.resources.require('entitySpatial').ensureCurrent(world)
  const melee = createEcsMeleeEngagementState()

  for (let initiativeIndex = 0; initiativeIndex < turnOrder.length; initiativeIndex++) {
    const entityId = turnOrder[initiativeIndex]
    if (world.stores.vitality.require(entityId).isDead) continue
    runModifierSystem(world, entityId, context.actions, expiredId => {
      resolveEcsDeath(world, expiredId, undefined, context.actions, 'expiration')
    })
    if (world.stores.vitality.require(entityId).isDead) continue
    const targetId = runTargetingSystem(world, entityId, melee)
    if (targetId === null) continue
    if (world.stores.periodicSpawnerCapability.has(entityId)) {
      runEcsPeriodicSpawnerSystem(world, entityId, targetId, context.actions, {
        rng, tick: context.tick,
      })
    }
    const canAct = canActOnTarget(world, entityId, targetId)
    const engaged = canAct ? reserveEcsMeleeSlot(world, entityId, targetId, melee) : true
    const acted = canAct && engaged
      ? runActionSystem(world, entityId, targetId, context.actions, { rng, tick: context.tick }).acted
      : false
    world.flushStructuralCommands()
    if (!acted) movementRequests.push({ entityId, targetId, initiativeIndex })
  }
}

function canActOnTarget(world: CombatWorld, entityId: EntityId, targetId: EntityId): boolean {
  const source = world.stores.identity.require(entityId)
  const target = world.stores.identity.require(targetId)
  if (source.team !== target.team) return true
  if (world.stores.weapon.require(entityId).attackType === 'heal') return true
  return world.stores.statusControl.require(entityId).statusEffects.some(effect =>
    effect.type === 'hacked' && effect.duration > 0 &&
    (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'),
  )
}
