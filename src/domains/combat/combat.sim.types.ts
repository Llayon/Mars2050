export type Team = 'attacker' | 'defender'

export interface StatusEffect {
  type: 'emp' | 'burn' | 'slow'
  duration: number
  value?: number
}

export interface Obstacle { x: number; y: number; radius: number }

export interface SimHazard {
  id: string
  team: Team
  type: 'napalm' | 'radiation' | 'emp_field' | 'acid' | 'emp'
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
  actionCooldownMax: number
  actionCooldown: number
  isFlying: boolean
  canTargetAir: boolean
  isTemporary?: boolean
  x: number
  y: number
  isDead: boolean
  squadId?: string
  attackTargetId?: string
  aggroLockTicks: number
  velocity: { x: number; y: number }
  turnSpeed: number
  currentAngle: number
  offsetX?: number
  offsetY?: number
  size: 'S' | 'M' | 'L' | 'XL'
  shield: number
  maxShield: number
  statusEffects: StatusEffect[]
  appliesEmp?: boolean
  leavesPuddle?: boolean
  spawnerConfig?: { unitType: string, interval: number, timer: number }
  initialAngle?: number
  isMoving?: boolean
  isNavigatingObstacle?: boolean
  replicateOnKill?: boolean
  stealthUntilAttack?: boolean
  hasAttacked?: boolean
  resurrectOnce?: boolean
  executeThreshold?: number
  lifestealMult?: number
  groundDamageMult?: number
  damageReductionWhileMoving?: number
  onDeathPuddle?: 'napalm' | 'acid' | 'emp'
  multishot?: number
  antiAirDamageMult?: number
}
