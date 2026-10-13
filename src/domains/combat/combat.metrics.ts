import type { ArenaSpec, UnitDefinition } from '@mars2050/combat-core/contracts'
import type { CombatCatalog, CombatMetrics as CoreCombatMetrics } from '@mars2050/combat-core'

export type BattleTimeoutPolicy = 'draw' | 'attacker_win' | 'defender_win' | 'defender_holds' | 'attacker_holds'

export interface BattleSimulationOptions {
  trackMetrics?: boolean
  maxTicks?: number
  timeoutPolicy?: BattleTimeoutPolicy
  profile?: boolean
  defenseResolutionMode?: 'v8_sequential' | 'v9_snapshot'
  arena?: ArenaSpec
  catalog?: CombatCatalog
  definitions?: Record<string, UnitDefinition>
}

export type CombatMetrics = CoreCombatMetrics
