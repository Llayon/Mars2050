import type { ArenaSpec, TimeoutPolicy } from './battle.contracts.js'
import type { DefenseResolutionMode } from './identity.contracts.js'

export interface BattleSimulationOptions {
  trackMetrics?: boolean
  maxTicks?: number
  timeoutPolicy?: TimeoutPolicy
  profile?: boolean
  defenseResolutionMode?: DefenseResolutionMode
  arena?: ArenaSpec
}

export interface MarkCombatMetrics {
  firstMarkTick: number | null
  markUptimeTicks: number
  uniqueMarkedSquads: number
  designationSwitchCount: number
  markRefreshCount: number
  alliedShotsWhileMarkActive: number
  shotsAgainstMarkedTargets: number
  markUtilization: number
  damageAgainstMarkedTargets: number
  bonusDamageFromMarks: number
  alliesRetargetedByMark: number
  markedTargetOverkillDamage: number
}

export interface CombatMetrics {
  firstAttackTick: number | null
  battleDurationTicks: number
  targetSwitches: number
  overlapSamples: number
  averageOverlap: number
  maxOverlap: number
  averageOverlapRatio: number
  maxOverlapRatio: number
  severeOverlapSamples: number
  averageTimeToEngage: number | null
  averageEngagementDistance: number | null
  meleeSlotWaitTicks: number
  stuckTicksByUnitType: Record<string, number>
  targetSwitchesByUnitType: Record<string, number>
  damageByUnitType: Record<string, number>
  damageTakenByUnitType: Record<string, number>
  healingDoneByUnitType: Record<string, number>
  killsByUnitType: Record<string, number>
  overkillDamage: number
  mark: MarkCombatMetrics
}
