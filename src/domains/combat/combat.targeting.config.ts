import type { TargetingProfileConfig, TargetingProfileKey } from './combat.types'

export const DEFAULT_TARGETING_PROFILE: TargetingProfileKey = 'default_local'

export const TARGETING_PROFILES: Record<TargetingProfileKey, TargetingProfileConfig> = {
  default_local: {
    acquisition: 'local',
    distanceWeight: 100000,
    currentTargetBonus: 50,
    lowHpWeight: 25,
    targetingCooldownTicks: 10,
  },
  long_range_priority: {
    acquisition: 'global',
    distanceWeight: 100000,
    currentTargetBonus: 60,
    lowHpWeight: 25,
    targetingCooldownTicks: 12,
    preferredTags: { armored: 120, heavy: 80, vehicle: 40 },
  },
  anti_air: {
    acquisition: 'local',
    distanceWeight: 100000,
    currentTargetBonus: 50,
    lowHpWeight: 15,
    targetingCooldownTicks: 10,
    preferredTags: { aircraft: 500 },
    avoidedTags: { structure: 40 },
  },
  anti_armor: {
    acquisition: 'local',
    distanceWeight: 100000,
    currentTargetBonus: 50,
    lowHpWeight: 15,
    targetingCooldownTicks: 10,
    preferredTags: { armored: 300, heavy: 140, vehicle: 80 },
    avoidedTags: { light: 30 },
  },
  siege: {
    acquisition: 'global',
    distanceWeight: 55000,
    currentTargetBonus: 70,
    lowHpWeight: 10,
    targetingCooldownTicks: 16,
    preferredTags: { structure: 1000, armored: 160, heavy: 160 },
    avoidedTags: { light: 80, aircraft: 120 },
  },
  assassin: {
    acquisition: 'global',
    distanceWeight: 80000,
    currentTargetBonus: 80,
    lowHpWeight: 50,
    targetingCooldownTicks: 12,
    preferredTags: { healer: 700, summoner: 300, light: 80, stealth: 80 },
    avoidedTags: { structure: 250, heavy: 80 },
  },
  support_hunter: {
    acquisition: 'local',
    distanceWeight: 90000,
    currentTargetBonus: 70,
    lowHpWeight: 35,
    targetingCooldownTicks: 12,
    preferredTags: { healer: 600, summoner: 450, shielded: 120 },
    avoidedTags: { structure: 120 },
  },
}
