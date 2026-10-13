import { Database, UnitsType } from '@/types/database'
import type {
  CombatMetadata,
  CombatSnapshotUnit,
  Obstacle,
  Team,
  BaseStats,
  PreparedStats,
} from '@mars2050/combat-core/contracts'
import type { UnitBaseStats } from '@mars2050/combat-core'
export type { UnitBaseStats }
export type SimUnit = CombatSnapshotUnit
import type {
  BattleAction,
  BattleActionType,
  BattleResult,
  BattleTick,
  AttackCancelReason,
} from './combat.actions'

export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType

export interface UnitTypeConfig {
  name: string
  baseStats: UnitBaseStats
  hireCost: Record<string, number>
  recruitable?: boolean
  squadSize?: number
  squadSpacing?: number
  formation?: 'line' | 'wedge' | 'grid'
  preparedStats?: PreparedStats
}

export type {
  CombatMetadata,
  CombatSnapshotUnit,
  Obstacle,
  Team,
  BaseStats,
  PreparedStats,
}
export type {
  BattleAction,
  BattleActionType,
  BattleResult,
  BattleTick,
  AttackCancelReason,
}
export { BATTLE_ACTION_TYPES } from './combat.actions'
