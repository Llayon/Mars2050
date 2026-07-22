import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { canEcsReceiveHeal, getEntityDistance } from './targeting-evaluation'

const SUPPORT_ACQUISITION_RADIUS = 420

export function selectEcsHealTarget(world: CombatWorld, unitId: EntityId): EntityId | null {
  const candidates = getSupportCandidates(world, unitId)
  const team = world.stores.identity.require(unitId).team
  const wounded = candidates.filter(entityId => {
    const identity = world.stores.identity.require(entityId)
    const vitality = world.stores.vitality.require(entityId)
    return !vitality.isDead && entityId !== unitId && identity.team === team && vitality.hp < vitality.maxHp && canEcsReceiveHeal(world, unitId, entityId)
  })
  return wounded.length > 0
    ? selectNearest(world, unitId, wounded)
    : selectSupportAnchor(world, unitId, candidates) ?? selectSupportAnchor(world, unitId, getUnits(world))
}

export function selectEcsPassiveSupportTarget(world: CombatWorld, unitId: EntityId): EntityId | null {
  const candidates = getSupportCandidates(world, unitId)
  return selectSupportAnchor(world, unitId, candidates) ?? selectSupportAnchor(world, unitId, getUnits(world))
}

export function isEcsPassiveSupport(world: CombatWorld, unitId: EntityId): boolean {
  const weapon = world.stores.weapon.require(unitId)
  return weapon.attackType !== 'spawn' && world.stores.combat.require(unitId).attack <= 0 && (world.stores.support.require(unitId).supportAuras?.length ?? 0) > 0
}

function getSupportCandidates(world: CombatWorld, unitId: EntityId): readonly EntityId[] {
  const transform = world.stores.transform.require(unitId)
  const candidates = world.resources.require('entitySpatial').query(world, transform.x, transform.y, SUPPORT_ACQUISITION_RADIUS)
  const team = world.stores.identity.require(unitId).team
  return candidates.some(entityId => entityId !== unitId && world.stores.identity.require(entityId).team === team) ? candidates : getUnits(world)
}

function selectSupportAnchor(world: CombatWorld, unitId: EntityId, candidates: readonly EntityId[]): EntityId | null {
  const team = world.stores.identity.require(unitId).team
  const allies = candidates.filter(entityId => !world.stores.vitality.require(entityId).isDead && entityId !== unitId && world.stores.identity.require(entityId).team === team)
  if (allies.length === 0) return null
  const enemies = candidates.filter(entityId => !world.stores.vitality.require(entityId).isDead && world.stores.identity.require(entityId).team !== team)
  const combatAllies = allies.filter(entityId => {
    const weapon = world.stores.weapon.require(entityId)
    const combat = world.stores.combat.require(entityId)
    return weapon.attackType !== 'heal' && (combat.speed > 0 || combat.attack > 0 || weapon.attackType === 'spawn')
  })
  let target: EntityId | null = null
  for (const candidate of combatAllies.length > 0 ? combatAllies : allies) {
    if (target === null || isBetterAnchor(world, unitId, candidate, target, enemies)) target = candidate
  }
  return target
}

function isBetterAnchor(world: CombatWorld, unitId: EntityId, candidate: EntityId, current: EntityId, enemies: readonly EntityId[]): boolean {
  const candidateEnemyDistance = nearestDistance(world, candidate, enemies)
  const currentEnemyDistance = nearestDistance(world, current, enemies)
  return candidateEnemyDistance !== currentEnemyDistance
    ? candidateEnemyDistance < currentEnemyDistance
    : isBetterTie(world, unitId, candidate, current)
}

function selectNearest(world: CombatWorld, unitId: EntityId, targets: readonly EntityId[]): EntityId | null {
  let target: EntityId | null = null
  for (const candidate of targets) if (target === null || isBetterTie(world, unitId, candidate, target)) target = candidate
  return target
}

function nearestDistance(world: CombatWorld, unitId: EntityId, targets: readonly EntityId[]): number {
  let nearest = Infinity
  for (const targetId of targets) nearest = Math.min(nearest, getEntityDistance(world, unitId, targetId))
  return nearest
}

function isBetterTie(world: CombatWorld, unitId: EntityId, candidate: EntityId, current: EntityId): boolean {
  const candidateDistance = getEntityDistance(world, unitId, candidate)
  const currentDistance = getEntityDistance(world, unitId, current)
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance
  const candidateHp = world.stores.vitality.require(candidate).hp
  const currentHp = world.stores.vitality.require(current).hp
  return candidateHp !== currentHp ? candidateHp < currentHp : getExternalId(world, candidate) < getExternalId(world, current)
}

function getUnits(world: CombatWorld): readonly EntityId[] {
  return world.query(['identity', 'transform', 'vitality', 'combat', 'weapon', 'targeting', 'entityTargets'])
}

function getExternalId(world: CombatWorld, entityId: EntityId): string {
  return world.stores.entityMeta.require(entityId).externalId
}
