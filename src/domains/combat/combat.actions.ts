import type { Team, SimUnit, Obstacle } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'

export type BattleActionType =
  | 'move' | 'attack' | 'heal' | 'die' | 'spawn' | 'hazard_spawn'
  | 'status_apply' | 'status_expire' | 'status_cleanse' | 'status_tick'
  | 'shield_apply'

export interface BattleAction {
  unitId: string
  type: BattleActionType
  targetId?: string
  damage?: number
  isCritical?: boolean
  isShieldHit?: boolean
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
  facingAngle?: number
  isWalking?: boolean
  spawnType?: string
  spawnTeam?: Team
  spawnMaxHp?: number
  hazardId?: string
  radius?: number
  statusType?: string
  value?: number
}

export interface BattleTick {
  tick: number
  actions: BattleAction[]
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  seed: number
  survivors: SimUnit[]
  initialState: SimUnit[]
  obstacles?: Obstacle[]
  metrics?: CombatMetrics
}
