import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { compareEntityExternalIdsForMode } from '../authored-order'

export interface EcsInitiativeGroup {
  speed: number
  entityIds: EntityId[]
}

export function getEcsInitiativeGroups(world: CombatWorld): EcsInitiativeGroup[] {
  const groups = new Map<number, EntityId[]>()
  for (const entityId of world.query(['identity', 'vitality', 'combat'])) {
    const speed = world.stores.combat.require(entityId).speed ?? 0
    const group = groups.get(speed) ?? []
    group.push(entityId)
    groups.set(speed, group)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([speed, entityIds]) => ({
      speed,
      entityIds: entityIds.sort((left, right) => compareEntityExternalIdsForMode(world, left, right)),
    }))
}

export function getEcsTurnOrder(world: CombatWorld, tick = 0): EntityId[] {
  const groups = new Map<number, EntityId[]>()
  for (const entityId of world.query(['identity', 'vitality', 'combat'])) {
    const speed = world.stores.combat.require(entityId).speed ?? 0
    const group = groups.get(speed) ?? []
    group.push(entityId)
    groups.set(speed, group)
  }

  const ordered: EntityId[] = []
  const speeds = [...groups.keys()].sort((left, right) => right - left)
  for (const speed of speeds) {
    const group = groups.get(speed) ?? []
    const attackers = group.filter(entityId => world.stores.identity.require(entityId).team === 'attacker')
    const defenders = group.filter(entityId => world.stores.identity.require(entityId).team === 'defender')
    const pairCount = Math.max(attackers.length, defenders.length)
    for (let index = 0; index < pairCount; index++) {
      const pair = (index + tick) % 2 === 0
        ? [attackers[index], defenders[index]]
        : [defenders[index], attackers[index]]
      for (const entityId of pair) if (entityId !== undefined) ordered.push(entityId)
    }
  }
  return ordered
}
