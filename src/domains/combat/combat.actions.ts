import type { Team, SimUnit, Obstacle } from './combat.sim.types'
import type { CombatMetrics } from './combat.metrics'
import type { TerminationReason } from './combat.result'
import type { SpatialQueryProfile } from './combat.spatial-profile'

export const BATTLE_ACTION_TYPES = [
  'move', 'knockback', 'attack', 'heal', 'heal_blocked', 'die', 'spawn', 'hazard_spawn',
  'damage', 'damage_share', 'shield_damage', 'shield_break', 'shield_hit_block', 'lifesteal', 'unit_blocked_damage',
  'status_apply', 'status_expire', 'status_cleanse', 'status_tick', 'status_immune',
  'shield_apply', 'target_mark', 'target_mark_expire', 'spawn_blocked', 'stance_change', 'burrow_change', 'mode_change',
  'projectile_intercept', 'projectile_launch', 'projectile_impact', 'projectile_miss', 'attack_windup', 'attack_cancel', 'stealth_change',
  'cone_attack', 'beam_tick',
  'barrage_marker', 'barrage_impact',
  'chain_jump',
  'split_fire', 'side_weapon_attack', 'ramp_charge', 'charge_damage', 'percent_hp_damage', 'on_kill',
  'periodic_ability', 'trigger_effect',
  'control_link', 'control_progress', 'control_break', 'control_convert',
  'transform_mode', 'field_effect', 'hazard_cleanse', 'barrier_absorb', 'adjacency_bonus',
  'barrier_spawn', 'barrier_break', 'barrier_expire',
  'stat_growth', 'attack_charge', 'attack_charge_release',
  'reassembly_start', 'reassembly_complete', 'burrow_regen', 'emerge_strike',
  'conditional_attack_mode', 'sweep_hit', 'self_destruct',
] as const

export const ATTACK_CANCEL_REASONS = [
  'source_dead', 'source_reassembled', 'status_blocked', 'control_mode_changed', 'target_lost',
] as const

export type AttackCancelReason = typeof ATTACK_CANCEL_REASONS[number]

export type BattleActionType = typeof BATTLE_ACTION_TYPES[number]

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
  motionKind?: 'locomotion' | 'steering' | 'depenetration' | 'turn'
  spawnType?: string
  spawnTeam?: Team
  spawnMaxHp?: number
  hazardId?: string
  radius?: number
  statusType?: string
  sourceUnitId?: string
  damageKind?: 'weapon' | 'dot' | 'hazard' | 'true'
  cause?: string
  controlMode?: string
  stanceMode?: string
  modeState?: string
  value?: number
  markEvent?: 'new_squad' | 'refresh'
  markSquadId?: string
  markDuration?: number
  retargetCount?: number
  bonusDamage?: number
  impactId?: number
  launchTick?: number
  impactTick?: number
  projectileKind?: 'projectile' | 'ground_targeted'
  cancelReason?: AttackCancelReason
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
  terminationReason: TerminationReason
  elapsedTicks: number
  simulationVersion: number
  profile?: SpatialQueryProfile
}
