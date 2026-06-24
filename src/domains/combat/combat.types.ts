import { Database, UnitsType, BattlesType } from '@/types/database'

export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType

export interface UnitBaseStats {
  hp: number; attack: number; defense: number; speed: number; range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; actionCooldownMax?: number
  isFlying?: boolean; canTargetAir?: boolean
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

export type { Team, StatusEffect, Obstacle, SimHazard, SimUnit } from './combat.sim.types'
export * from './combat.actions'

