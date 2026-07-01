import { UNIT_TYPES } from './combat.config'
import { DEFAULT_TARGETING_PROFILE, TARGETING_PROFILES } from './combat.targeting.config'
import type { SimUnit } from './combat.sim.types'
import type { CombatTag, TargetingProfileConfig, TargetingProfileKey } from './combat.types'
import { getDistance } from './combat.utils'

const TAG_DISTANCE_RATIO_CAP = 3

export interface TargetScoreBreakdown {
  targetId: string
  profileKey: TargetingProfileKey
  distance: number
  nearestDistance: number
  distanceScore: number
  currentTargetScore: number
  lowHpScore: number
  preferredTagScore: number
  avoidedTagPenalty: number
  tagDistancePenalty: number
  tagScore: number
  total: number
  tags: CombatTag[]
}

export function getTargetingProfileKey(unit: SimUnit): TargetingProfileKey {
  return UNIT_TYPES[unit.type as keyof typeof UNIT_TYPES]?.baseStats.targetingProfile ?? DEFAULT_TARGETING_PROFILE
}

export function getTargetingProfile(unit: SimUnit): TargetingProfileConfig {
  return TARGETING_PROFILES[getTargetingProfileKey(unit)]
}

export function getTargetScore(
  unit: SimUnit,
  enemy: SimUnit,
  profile: TargetingProfileConfig = getTargetingProfile(unit),
  nearestDistance = getDistance(unit.x, unit.y, enemy.x, enemy.y)
): TargetScoreBreakdown {
  const distance = Math.max(1, getDistance(unit.x, unit.y, enemy.x, enemy.y))
  const clampedNearestDistance = Math.max(1, nearestDistance)
  const distanceScore = profile.distanceWeight / distance
  const currentTargetScore = enemy.id === unit.attackTargetId ? profile.currentTargetBonus : 0
  const hpRatio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 1
  const lowHpScore = (1 - hpRatio) * profile.lowHpWeight
  const tagParts = getCombatTagScore(enemy, profile, distance, clampedNearestDistance)
  const total = distanceScore + currentTargetScore + lowHpScore + tagParts.tagScore

  return {
    targetId: enemy.id,
    profileKey: getTargetingProfileKey(unit),
    distance,
    nearestDistance: clampedNearestDistance,
    distanceScore,
    currentTargetScore,
    lowHpScore,
    ...tagParts,
    total,
    tags: getEffectiveCombatTags(enemy),
  }
}

export function getEffectiveCombatTags(unit: SimUnit): CombatTag[] {
  const tags = new Set<CombatTag>(UNIT_TYPES[unit.type as keyof typeof UNIT_TYPES]?.baseStats.combatTags ?? [])
  if (unit.isFlying) tags.add('aircraft')
  if (unit.shield > 0) tags.add('shielded')
  if (unit.attackType === 'heal') tags.add('healer')
  if (unit.attackType === 'spawn') tags.add('summoner')
  if (unit.summonOwnerId || unit.isTemporary) tags.add('summoned')
  return [...tags].sort()
}

function getCombatTagScore(
  enemy: SimUnit,
  profile: TargetingProfileConfig,
  distance: number,
  nearestDistance: number
) {
  let preferredTagScore = 0
  let avoidedTagPenalty = 0
  for (const tag of getEffectiveCombatTags(enemy)) {
    preferredTagScore += profile.preferredTags?.[tag] ?? 0
    avoidedTagPenalty += profile.avoidedTags?.[tag] ?? 0
  }

  const rawTagScore = preferredTagScore - avoidedTagPenalty
  const tagDistancePenalty = distance > nearestDistance * TAG_DISTANCE_RATIO_CAP && rawTagScore > 0 ? rawTagScore : 0
  const tagScore = rawTagScore - tagDistancePenalty
  return { preferredTagScore, avoidedTagPenalty, tagDistancePenalty, tagScore }
}
