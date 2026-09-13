import { Database, UnitsType } from '@/types/database'
export type UnitRow = Database['public']['Tables']['units']['Row']
export type BattleRow = Database['public']['Tables']['battles']['Row']
export type UnitTypeKey = UnitsType
export * from '@mars2050/combat-core/combat.types'
