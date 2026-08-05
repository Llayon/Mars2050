import type { CompiledAbilityProgram } from './combat.ability-compiler'
import type { AttackDeliveryConfig } from './combat.types'

export interface CompiledBarrageShellPlan {
  impacts: number
  radius: number
  damageMultiplier: number
  maxTargets: number | undefined
  impactIntervalTicks: number
  offsets: readonly { x: number; y: number }[]
}

export interface CompiledTemporalWeaponPlan {
  delivery: Exclude<AttackDeliveryConfig, { kind: 'instant' }>
  barrage?: CompiledBarrageShellPlan
  impactPrograms: readonly CompiledAbilityProgram[]
}
