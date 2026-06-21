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
  attackType: 'single' | 'aoe' | 'heal'
  aoeRadius?: number
}

export interface UnitTypeConfig {
  name: string
  baseStats: UnitBaseStats
  hireCost: Record<string, number>
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
  attackType: 'single' | 'aoe' | 'heal'
  aoeRadius?: number
  x: number
  y: number
  isDead: boolean
  moveTimer?: number
}

export type BattleActionType = 'move' | 'attack' | 'heal' | 'die'

export interface BattleAction {
  unitId: string
  type: BattleActionType
  targetId?: string
  damage?: number
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
}

export interface BattleTick {
  tick: number
  actions: BattleAction[]
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  survivors: SimUnit[]
}
