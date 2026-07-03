import type { CombatTag } from './combat.types'

export type Team = 'attacker' | 'defender'
export type StatusType =
  | 'emp' | 'slow' | 'burn' | 'acid' | 'vulnerable' | 'range_suppressed' | 'revealed'
  | 'hacked' | 'damage_reduction' | 'regen' | 'output_suppressed' | 'accuracy_reduced' | 'armor_broken' | 'degeneration' | 'haste' | 'range_boost' | 'status_immunity'
export type HackControlMode = 'disable' | 'redirect' | 'confuse'
export type StanceMode = 'mobile' | 'deployed'
export type MobilityMode = 'ground' | 'air'
export interface UnitStanceConfig { mode: 'siege' | 'entrenched'; deployTicks: number; rangeMultiplier?: number; cooldownMultiplier?: number; speedMultiplier?: number }
export interface BurrowConfig { damageReduction: number }
export interface UnitModeSwitchConfig { trigger: 'while_moving'; startMode?: MobilityMode; groundForAction?: boolean; airSpeedMultiplier?: number; groundSpeedMultiplier?: number }

export interface StatusEffect { type: StatusType; duration: number; value?: number; sourceUnitId?: string; stackKey?: string; controlMode?: HackControlMode }

export interface TargetMark { sourceUnitId: string; duration: number; damageMultiplier?: number; executeThreshold?: number }
export type TargetMarkConfig = Omit<TargetMark, 'sourceUnitId'>

export type SupportAuraType = 'shield' | 'shield_repair' | 'regen' | 'reveal' | 'damage_reduction' | 'haste' | 'range_boost' | 'cleanse' | 'status_immunity'
export type SupportAuraTarget = 'allies' | 'enemies'

export interface SupportAura {
  type: SupportAuraType; radius: number; value: number; duration?: number; interval?: number
  target: SupportAuraTarget; targetTags?: CombatTag[]
}

export interface Obstacle { x: number; y: number; radius: number }

export interface SimHazard { id: string; team: Team; type: 'napalm' | 'radiation' | 'emp_field' | 'acid' | 'emp' | 'mine' | 'smoke'; x: number; y: number; radius: number; damagePerTick: number; duration: number; statusEffects?: StatusEffect[] }

export interface SimUnit {
  id: string
  team: Team
  type: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  range: number
  attackType: 'single' | 'aoe' | 'heal' | 'spawn'
  aoeRadius?: number; spawnType?: string; spawnCap?: number
  actionCooldownMax: number
  actionCooldown: number
  isFlying: boolean
  canTargetAir: boolean
  isTemporary?: boolean; temporaryDuration?: number
  x: number
  y: number
  isDead: boolean
  squadId?: string
  summonOwnerId?: string
  attackTargetId?: string
  rampTargetId?: string; rampMultiplier?: number; chargeDistance?: number
  aggroLockTicks: number
  meleeSlotTargetId?: string
  meleeSlotIndex?: number
  meleeWaitingTargetId?: string
  velocity: { x: number; y: number }
  turnSpeed: number
  currentAngle: number
  offsetX?: number
  offsetY?: number
  size: 'S' | 'M' | 'L' | 'XL'
  shield: number
  maxShield: number
  statusEffects: StatusEffect[]
  statusOnHit?: StatusEffect[]; markOnHit?: TargetMarkConfig; targetMark?: TargetMark
  supportAuras?: SupportAura[]
  appliesEmp?: boolean
  leavesPuddle?: boolean
  spawnerConfig?: { unitType: string, interval: number, timer: number }
  initialAngle?: number
  isMoving?: boolean
  isNavigatingObstacle?: boolean
  lastProgressX?: number
  lastProgressY?: number
  lastTargetDistance?: number
  lastProgressTargetId?: string
  stuckTicks?: number
  avoidanceSide?: -1 | 1
  avoidanceTicks?: number
  replicateOnKill?: boolean
  stealthUntilAttack?: boolean
  hasAttacked?: boolean
  resurrectOnce?: boolean
  executeThreshold?: number
  lifestealMult?: number
  groundDamageMult?: number; shieldDamageMult?: number; armorPierceRatio?: number; summonCounterDamageMult?: number; accuracyPenaltyResist?: number
  damageReductionWhileMoving?: number
  burrowConfig?: BurrowConfig; isBurrowed?: boolean
  modeSwitchConfig?: UnitModeSwitchConfig; mobilityMode?: MobilityMode
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot?: number; antiAirDamageMult?: number
  smokeOnAction?: { radius: number; duration: number; rangeSuppression?: number; outputSuppression?: number; accuracySuppression?: number }
  stanceConfig?: UnitStanceConfig; stanceMode?: StanceMode; stanceTicks?: number
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }; knockbackOnHit?: { radius: number; strength: number; maxTargets?: number }; reactiveArmorCharges?: number; reactiveArmorBlock?: number; damageShareRadius?: number; damageShareRatio?: number; damageShareMaxTargets?: number
  projectileInterceptRadius?: number; projectileInterceptCooldownMax?: number; projectileInterceptCooldown?: number; projectileInterceptMaxDamage?: number
}
