import type { BattleAction } from './combat.actions'
import type { Team } from './combat.sim.types'
import type { GlobalUpgradeConfig } from './combat.upgrades'
import type { PRNG } from './combat.utils'

export const COMBAT_PHASE_IDS = [
  'reassembly',
  'global_effect',
  'support_aura',
  'growth_charge',
  'burrow_regeneration',
  'transform_mode',
  'field_effect',
  'formation_bonus',
  'control_beam',
  'periodic_ability',
  'structural_flush',
  'status',
  'actor_turn',
  'batch_movement',
  'temporal_timeline',
  'projectile_impact',
  'hazard',
  'hp_threshold_trigger',
] as const

export type CombatPhaseId = typeof COMBAT_PHASE_IDS[number]
export type CombatPhaseStage = 'pre_action' | 'action' | 'post_action'

export interface RuntimePhaseContext {
  tick: number
  actions: BattleAction[]
  rng?: PRNG
  activeGlobals?: { team: Team; upg: GlobalUpgradeConfig }[]
}
