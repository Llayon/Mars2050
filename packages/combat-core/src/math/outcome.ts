import type { Team } from '../contracts/index.js'

export const TIMEOUT_POLICIES = ['draw', 'attacker_holds', 'defender_holds'] as const
export type SimTimeoutPolicy = typeof TIMEOUT_POLICIES[number]

export const TERMINATION_REASONS = [
  'elimination',
  'mutual_elimination',
  'stalemate',
  'timeout',
] as const
export type TerminationReason = typeof TERMINATION_REASONS[number]

export type BattleWinner = Team | 'draw'
export interface BattleOutcome { winner: BattleWinner; reason: TerminationReason }

export function getTimeoutOutcome(policy: SimTimeoutPolicy): BattleOutcome {
  if (policy === 'attacker_holds') return { winner: 'attacker', reason: 'timeout' }
  return { winner: policy === 'defender_holds' ? 'defender' : 'draw', reason: 'timeout' }
}
