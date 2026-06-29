export type Team = 'attacker' | 'defender'
export type StatusType =
  | 'emp' | 'slow' | 'burn' | 'acid' | 'vulnerable' | 'range_suppressed' | 'revealed'
  | 'hacked' | 'damage_reduction' | 'regen' | 'output_suppressed' | 'armor_broken' | 'degeneration' | 'haste' | 'status_immunity'

export interface StatusEffect { type: StatusType; duration: number; value?: number; sourceUnitId?: string; stackKey?: string }

export interface TargetMark { sourceUnitId: string; duration: number; damageMultiplier?: number; executeThreshold?: number }
export type TargetMarkConfig = Omit<TargetMark, 'sourceUnitId'>

export type SupportAuraType = 'shield' | 'regen' | 'reveal' | 'damage_reduction' | 'cleanse' | 'status_immunity'
export type SupportAuraTarget = 'allies' | 'enemies'

export interface SupportAura {
  type: SupportAuraType; radius: number; value: number
  duration?: number
  interval?: number
  target: SupportAuraTarget
}

export interface Obstacle { x: number; y: number; radius: number }

export interface SimHazard {
  id: string
  team: Team
  type: 'napalm' | 'radiation' | 'emp_field' | 'acid' | 'emp' | 'mine'
  x: number
  y: number
  radius: number
  damagePerTick: number
  duration: number
}

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
  aoeRadius?: number
  spawnType?: string
  spawnCap?: number
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
  groundDamageMult?: number
  damageReductionWhileMoving?: number
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot?: number; antiAirDamageMult?: number
  pullOnHit?: { radius: number; strength: number; maxTargets?: number }; reactiveArmorCharges?: number; reactiveArmorBlock?: number; damageShareRadius?: number; damageShareRatio?: number; damageShareMaxTargets?: number
}
