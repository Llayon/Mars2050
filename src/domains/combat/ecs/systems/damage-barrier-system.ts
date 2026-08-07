import { getDistance } from '../../combat.utils'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { breakBarrier, consumeBarrierCapacity } from '../defense-resource-commit'
import { compareExternalIdsForMode } from '../authored-order'

export interface EcsBarrierResult {
  damage: number
  blockedDamage: number
  breaks: { hazardId: string; sourceUnitId: string }[]
}

export function applyEcsBarriers(world: CombatWorld, targetId: EntityId, incomingDamage: number): EcsBarrierResult {
  const target = world.stores.transform.require(targetId)
  const team = world.stores.identity.require(targetId).team
  const barriers = world.query(['entityMeta', 'hazard'], true)
    .filter(entityId => {
      const hazard = world.stores.hazard.require(entityId)
      return hazard.type === 'barrier_dome' && hazard.team === team && hazard.duration > 0 &&
        getDistance(target.x, target.y, hazard.x, hazard.y) <= hazard.radius
    })
    .sort((left, right) => compareExternalIdsForMode(world, world.stores.entityMeta.require(left).externalId, world.stores.entityMeta.require(right).externalId))
  let damage = incomingDamage
  const breaks: EcsBarrierResult['breaks'] = []
  for (const barrierId of barriers) {
    if (damage <= 0) break
    const barrier = world.stores.hazard.require(barrierId)
    if ((barrier.capacity ?? 0) <= 0) continue
    const absorbed = consumeBarrierCapacity(world, barrierId, damage)
    damage -= absorbed
    if ((world.stores.hazard.require(barrierId).capacity ?? 0) <= 0) {
      breakBarrier(world, barrierId)
      breaks.push({ hazardId: barrier.id, sourceUnitId: barrier.sourceUnitId ?? barrier.id })
    }
  }
  let reduction = 0
  for (const barrierId of barriers) {
    const barrier = world.stores.hazard.require(barrierId)
    if (barrier.duration > 0) reduction = Math.max(reduction, Math.max(0, Math.min(0.95, barrier.damageReduction ?? 0)))
  }
  if (reduction > 0) damage = Math.floor(damage * (1 - reduction))
  return { damage, blockedDamage: incomingDamage - damage, breaks }
}
