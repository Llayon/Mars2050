import type { PRNG } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function spawnEcsAttackPuddle(
  world: CombatWorld,
  entityId: EntityId,
  targetId: EntityId,
  rng: PRNG,
): void {
  const weapon = world.stores.weapon.require(entityId)
  if (!weapon.leavesPuddle) return
  const identity = world.stores.identity.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const target = world.stores.transform.require(targetId)
  world.queueHazardCreation({
    id: world.allocateExternalId('hazard'),
    team: identity.team,
    type: 'napalm',
    x: target.x,
    y: target.y,
    radius: 40,
    damagePerTick: Math.floor(combat.attack * 0.2),
    duration: 50,
  })
}
