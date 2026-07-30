import { UNIT_TYPES } from '../combat.config'
import type { CombatTag } from '../combat.primitives'
import { DEFAULT_TARGETING_PROFILE, TARGETING_PROFILES } from '../combat.targeting.config'
import type { TargetingProfileConfig, TargetingProfileKey, UnitTypeKey } from '../combat.types'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

const TAG_DISTANCE_RATIO_CAP = 3

export function getEcsTargetingProfile(world: CombatWorld, entityId: EntityId): TargetingProfileConfig {
  return TARGETING_PROFILES[getProfileKey(world, entityId)]
}

export function getEcsMaxActionRange(world: CombatWorld, entityId: EntityId): number {
  const targeting = world.stores.targeting.require(entityId)
  const base = getEffectiveRange(world, entityId)
  let range = base
  for (const config of targeting.conditionalRange ?? []) {
    let candidate = base
    if (config.rangeMult !== undefined) candidate *= Math.max(0, config.rangeMult)
    if (config.rangeAdd !== undefined) candidate += config.rangeAdd
    range = Math.max(range, candidate)
  }
  return Math.max(0, range)
}

export function getEcsTargetScore(
  world: CombatWorld,
  unitId: EntityId,
  enemyId: EntityId,
  profile: TargetingProfileConfig,
  nearestDistance: number,
  knownDistance?: number,
): number {
  const unitTargeting = world.stores.targeting.require(unitId)
  const enemyVitality = world.stores.vitality.require(enemyId)
  const distance = Math.max(1, knownDistance ?? getEntityDistance(world, unitId, enemyId))
  const hpRatio = enemyVitality.maxHp > 0 ? Math.max(0, enemyVitality.hp / enemyVitality.maxHp) : 1
  let tagScore = 0
  for (const tag of getEcsCombatTags(world, enemyId)) {
    tagScore += (profile.preferredTags?.[tag] ?? 0) - (profile.avoidedTags?.[tag] ?? 0)
  }
  if (distance > Math.max(1, nearestDistance) * TAG_DISTANCE_RATIO_CAP && tagScore > 0) tagScore = 0
  const refs = world.stores.entityTargets.require(unitId)
  const current = refs.attackTarget === enemyId ? profile.currentTargetBonus : 0
  const mark = world.stores.statusControl.require(enemyId).targetMark
  const markPriority = mark && mark.duration > 0 ? Math.max(0, mark.focusPriority ?? 0) : 0
  return profile.distanceWeight / distance + current + (1 - hpRatio) * profile.lowHpWeight + tagScore + markPriority + getRuntimePriority(world, unitTargeting.targetPriorityProfile, enemyId)
}

export function getEcsCombatTags(world: CombatWorld, entityId: EntityId): CombatTag[] {
  const identity = world.stores.identity.require(entityId)
  const transform = world.stores.transform.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  const weapon = world.stores.weapon.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const refs = world.stores.entityTargets.require(entityId)
  const signature =
    (transform.isFlying ? 1 : 0) |
    (vitality.shield > 0 ? 2 : 0) |
    (weapon.attackType === 'heal' ? 4 : 0) |
    (weapon.attackType === 'spawn' ? 8 : 0) |
    (refs.summonOwner !== undefined ? 16 : 0) |
    (vitality.isTemporary ? 32 : 0) |
    (movement.modeSwitchConfig && !transform.isFlying ? 64 : 0)
  let cache = world.resources.get('combatTagCache')
  if (!cache) {
    cache = new Map()
    world.resources.set('combatTagCache', cache)
  }
  const cached = cache.get(entityId)
  if (cached?.signature === signature) return cached.tags
  const tags = new Set<CombatTag>(
    UNIT_TYPES[identity.type as UnitTypeKey]?.baseStats.combatTags ?? [],
  )
  if (movement.modeSwitchConfig && !transform.isFlying) tags.delete('aircraft')
  if (transform.isFlying) tags.add('aircraft')
  if (vitality.shield > 0) tags.add('shielded')
  if (weapon.attackType === 'heal') tags.add('healer')
  if (weapon.attackType === 'spawn') tags.add('summoner')
  if (refs.summonOwner !== undefined || vitality.isTemporary) tags.add('summoned')
  const result = [...tags].sort()
  cache.set(entityId, { signature, tags: result })
  return result
}

export function canEcsTarget(world: CombatWorld, attackerId: EntityId, targetId: EntityId): boolean {
  const attacker = world.stores.combat.require(attackerId)
  const target = world.stores.transform.require(targetId)
  return !target.isFlying || attacker.canTargetAir
}

export function isEcsTargetVisible(world: CombatWorld, targetId: EntityId): boolean {
  const status = world.stores.statusControl.require(targetId)
  const movement = world.stores.movement.require(targetId)
  const revealed = status.statusEffects.some(effect => effect.type === 'revealed' && effect.duration > 0)
  if (revealed) return true
  if (status.stealthUntilAttack && !status.hasAttacked) return false
  return !(movement.stealthWhileMoving && movement.movementStealthActive && !status.hasAttacked)
}

export function canEcsReceiveHeal(world: CombatWorld, sourceId: EntityId, targetId: EntityId): boolean {
  const source = world.stores.identity.require(sourceId)
  const targetTags = UNIT_TYPES[source.type as UnitTypeKey]?.baseStats.healTargetTags
  if (!targetTags?.length) return true
  const effectiveTags = new Set(getEcsCombatTags(world, targetId))
  return targetTags.some(tag => effectiveTags.has(tag))
}

export function getEntityDistance(world: CombatWorld, leftId: EntityId, rightId: EntityId): number {
  const left = world.stores.transform.require(leftId)
  const right = world.stores.transform.require(rightId)
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function getProfileKey(world: CombatWorld, entityId: EntityId): TargetingProfileKey {
  const type = world.stores.identity.require(entityId).type as UnitTypeKey
  return UNIT_TYPES[type]?.baseStats.targetingProfile ?? DEFAULT_TARGETING_PROFILE
}

function getEffectiveRange(world: CombatWorld, entityId: EntityId): number {
  const combat = world.stores.combat.require(entityId)
  const movement = world.stores.movement.require(entityId)
  const statuses = world.stores.statusControl.require(entityId).statusEffects
  let range = combat.range
  if (movement.stanceMode === 'deployed' && (movement.stanceConfig?.rangeMultiplier ?? 0) > 0) range *= movement.stanceConfig!.rangeMultiplier!
  const boost = getStrongestStatus(statuses, 'range_boost')
  const suppression = getStrongestStatus(statuses, 'range_suppressed')
  if (boost !== undefined && boost > 0) range *= Math.min(3, boost >= 1 ? boost : 1 + boost)
  if (suppression !== undefined && suppression > 0) {
    const reduction = suppression <= 1 ? suppression : suppression / 100
    range *= Math.max(0.05, 1 - Math.min(0.95, reduction))
  }
  return range
}

function getStrongestStatus(statuses: { type: string; duration: number; value?: number }[], type: string): number | undefined {
  let value: number | undefined
  for (const effect of statuses) {
    if (effect.type !== type || effect.duration <= 0 || effect.value === undefined) continue
    value = value === undefined ? effect.value : Math.max(value, effect.value)
  }
  return value
}

function getRuntimePriority(world: CombatWorld, profile: string | undefined, enemyId: EntityId): number {
  const enemy = world.stores.vitality.require(enemyId)
  const transform = world.stores.transform.require(enemyId)
  const marked = world.stores.statusControl.require(enemyId).targetMark
  if (profile === 'highest_max_hp') return Math.max(0, enemy.maxHp)
  if (profile === 'air_first') return transform.isFlying ? 5000 : 0
  if (profile === 'heavy_first') return getEcsCombatTags(world, enemyId).some(tag => tag === 'heavy' || tag === 'armored') ? 3000 : 0
  if (profile === 'marked_focus') return marked && marked.duration > 0 ? 5000 : 0
  return 0
}
