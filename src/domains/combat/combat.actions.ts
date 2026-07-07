import type { Team, SimUnit, Obstacle } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'

export type BattleActionType =
  | 'move' | 'knockback' | 'attack' | 'heal' | 'die' | 'spawn' | 'hazard_spawn'
  | 'damage' | 'damage_share' | 'shield_damage' | 'shield_break' | 'shield_hit_block' | 'lifesteal' | 'unit_blocked_damage'
  | 'status_apply' | 'status_expire' | 'status_cleanse' | 'status_tick' | 'status_immune'
  | 'shield_apply' | 'target_mark' | 'target_mark_expire' | 'spawn_blocked' | 'stance_change' | 'burrow_change' | 'mode_change'
  | 'projectile_intercept' | 'stealth_change'
  | 'cone_attack' | 'beam_tick'
  | 'barrage_marker' | 'barrage_impact'
  | 'chain_jump'
  | 'split_fire' | 'side_weapon_attack' | 'ramp_charge' | 'charge_damage' | 'percent_hp_damage' | 'on_kill'
  | 'periodic_ability' | 'trigger_effect'
  | 'control_link' | 'control_progress' | 'control_break' | 'control_convert'
  | 'transform_mode' | 'field_effect' | 'hazard_cleanse' | 'barrier_absorb' | 'adjacency_bonus'
  | 'barrier_spawn' | 'barrier_break' | 'barrier_expire'
  | 'stat_growth' | 'attack_charge' | 'attack_charge_release'
  | 'reassembly_start' | 'reassembly_complete' | 'burrow_regen' | 'emerge_strike'
  | 'conditional_attack_mode' | 'sweep_hit'

export interface BattleAction {
  unitId: string
  type: BattleActionType
  targetId?: string
  damage?: number
  isCritical?: boolean
  isShieldHit?: boolean
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
  facingAngle?: number
  isWalking?: boolean
  spawnType?: string
  spawnTeam?: Team
  spawnMaxHp?: number
  hazardId?: string
  radius?: number
  statusType?: string
  controlMode?: string
  stanceMode?: string
  modeState?: string
  value?: number
}

export interface BattleTick {
  tick: number
  actions: BattleAction[]
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  seed: number
  survivors: SimUnit[]
  initialState: SimUnit[]
  obstacles?: Obstacle[]
  metrics?: CombatMetrics
}
