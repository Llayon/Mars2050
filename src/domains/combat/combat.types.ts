import { Database, UnitsType, BattlesType } from '@/types/database'

export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType

export interface UnitBaseStats {
  hp: number
  attack: number
  defense: number
  speed: number
  range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number
  spawnType?: string
  actionCooldownMax?: number
  isFlying?: boolean
  canTargetAir?: boolean
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

export type Team = 'attacker' | 'defender'

export interface StatusEffect {
  type: 'emp' | 'burn' | 'slow'
  duration: number
  value?: number
}

export interface SimHazard {
  id: string
  team: Team
  type: 'napalm' | 'radiation' | 'emp_field'
  x: number
  y: number
  radius: number
  damagePerTick: number
  duration: number
}

export interface SimUnit {
  id: string
  team: Team
  type: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number
  spawnType?: string
  actionCooldownMax: number
  actionCooldown: number
  isFlying: boolean
  canTargetAir: boolean
  isTemporary?: boolean
  x: number
  y: number
  isDead: boolean
  squadId?: string
  moveTimer?: number
  turnSpeed: number
  currentAngle: number
  offsetX?: number
  offsetY?: number
  size: 'S' | 'M' | 'L' | 'XL'
  shield: number
  maxShield: number
  statusEffects: StatusEffect[]
  appliesEmp?: boolean
  leavesPuddle?: boolean
  spawnerConfig?: { unitType: string, interval: number, timer: number }
  initialAngle?: number
}

export * from './combat.actions'


