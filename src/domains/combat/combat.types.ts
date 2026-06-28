import { Database, UnitsType } from '@/types/database'
import type { StatusEffect, SupportAura } from './combat.sim.types'

export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType
export type TargetingAcquisition = 'local' | 'global'
export type CombatTag =
  | 'infantry' | 'vehicle' | 'aircraft' | 'structure'
  | 'organic' | 'mechanical' | 'armored' | 'light' | 'heavy'
  | 'shielded' | 'healer' | 'summoner' | 'stealth' | 'explosive'
export type TargetingProfileKey =
  | 'default_local' | 'long_range_priority' | 'anti_air'
  | 'anti_armor' | 'siege' | 'assassin' | 'support_hunter'
export type TargetingProfile = TargetingProfileKey

export interface TargetingProfileConfig {
  acquisition: TargetingAcquisition
  distanceWeight: number
  currentTargetBonus: number
  lowHpWeight: number
  targetingCooldownTicks?: number
  preferredTags?: Partial<Record<CombatTag, number>>
  avoidedTags?: Partial<Record<CombatTag, number>>
}

export interface UnitBaseStats {
  hp: number; attack: number; defense: number; speed: number; range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; actionCooldownMax?: number
  spawnOverrides?: { hp?: number; attack?: number; isTemporary?: boolean; duration?: number }
  linePierce?: { width: number; damageMultiplier: number; maxTargets?: number }
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }
  statusOnHit?: StatusEffect[]
  supportAuras?: SupportAura[]
  mineOnAction?: { radius: number; damage: number; duration: number }
  isFlying?: boolean; canTargetAir?: boolean
  targetingProfile?: TargetingProfile
  combatTags?: CombatTag[]
  turnSpeed?: number // Radians per tick
  size?: 'S' | 'M' | 'L' | 'XL'
}

export interface UnitTypeConfig {
  name: string
  baseStats: UnitBaseStats
  hireCost: Record<string, number>
  squadSize?: number
  squadSpacing?: number
  formation?: 'line' | 'wedge' | 'grid'
}

export type { Team, StatusEffect, StatusType, SupportAura, SupportAuraType, Obstacle, SimHazard, SimUnit } from './combat.sim.types'
export * from './combat.actions'

