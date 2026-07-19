import type { Team } from './combat.sim.types'
import type { TerminationReason, TimeoutPolicy } from './combat.result'

export type BattleWinner = Team | 'draw'
export interface BattleOutcome { winner: BattleWinner; reason: TerminationReason }

export function getTimeoutOutcome(policy: TimeoutPolicy): BattleOutcome {
  return { winner: policy === 'defender_holds' ? 'defender' : 'draw', reason: 'timeout' }
}
