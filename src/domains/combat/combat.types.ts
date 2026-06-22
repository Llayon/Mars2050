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
  actionCooldownMax: number
  actionCooldown: number
  isFlying: boolean
  canTargetAir: boolean
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
}

export type BattleActionType = 'move' | 'attack' | 'heal' | 'die' | 'spawn'

export interface BattleAction {
  unitId: string
  type: BattleActionType
  targetId?: string
  damage?: number
  isCritical?: boolean
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
  facingAngle?: number
  spawnType?: string
  spawnTeam?: Team
  spawnMaxHp?: number
}

export interface BattleTick {
  tick: number
  actions: BattleAction[]
}

export interface Obstacle {
  x: number
  y: number
  radius: number
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  seed?: number
  survivors: SimUnit[]
  initialState: SimUnit[]
  obstacles?: Obstacle[]
}
