export const TIMEOUT_POLICIES = ['draw', 'defender_holds'] as const
export type TimeoutPolicy = typeof TIMEOUT_POLICIES[number]

export const TERMINATION_REASONS = [
  'elimination',
  'mutual_elimination',
  'stalemate',
  'timeout',
] as const
export type TerminationReason = typeof TERMINATION_REASONS[number]

export const COMBAT_ENGINES = ['legacy', 'ecs'] as const
export type CombatEngineKind = typeof COMBAT_ENGINES[number]

