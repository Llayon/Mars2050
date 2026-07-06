export type TargetPriorityProfile = 'highest_max_hp' | 'air_first' | 'heavy_first' | 'marked_focus'

export interface StatGrowthConfig {
  intervalTicks: number
  maxStacks: number
  attackMultPerStack?: number
  hpMultPerStack?: number
}

export interface RuntimeStatGrowth extends StatGrowthConfig {
  nextTick: number
  stacks: number
}

export interface AttackChargeConfig {
  intervalTicks: number
  maxStacks: number
  attackMultPerStack: number
}

export interface RuntimeAttackCharge extends AttackChargeConfig {
  nextTick: number
  stacks: number
}

export interface DelayedReassemblyConfig {
  delayTicks: number
  hpPercent?: number
  maxTriggers?: number
}

export interface ReassemblyState {
  remainingTicks: number
  hpPercent: number
  sourceUnitId: string
}

export interface ConditionalAttackModeConfig {
  minTargets: number
  radius: number
  damageMultiplier: number
}

export interface SweepAttackConfig {
  width: number
  damageMultiplier: number
  maxTargets?: number
  sizeBonusMultiplier?: Partial<Record<'S' | 'M' | 'L' | 'XL', number>>
}
