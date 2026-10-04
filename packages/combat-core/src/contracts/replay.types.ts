import type { Team } from './unit.contracts.js'

export interface CombatVelocityDto {
  x: number
  y: number
}

export interface CombatStatusEffectDto {
  type: string
  duration: number
  value?: number
  sourceId?: string
  sourceUnitId?: string
  stackKey?: string
  controlMode?: string
  tickInterval?: number
  nextTickIn?: number
  maxStacks?: number
  elapsedTicks?: number
  appliedAtTick?: number
  sourceUnitType?: string
  sourceTeam?: string
  damageType?: string
  sourceUpgradeId?: string
  shieldAmount?: number
}

export interface CombatSnapshotUnit {
  id: string
  team: Team
  type: string
  x: number
  y: number
  hp: number
  maxHp: number
  speed?: number; range?: number; attack?: number; defense?: number; shield?: number; maxShield?: number
  velocity?: CombatVelocityDto; statusEffects?: CombatStatusEffectDto[]
  squadId?: string; squadLeader?: string; currentAngle?: number; initialAngle?: number
  offsetX?: number; offsetY?: number; size?: 'S' | 'M' | 'L' | 'XL'; isFlying?: boolean; isDead?: boolean
  direction?: number; targetId?: string; summonOwnerId?: string; summonSourceId?: string; isTemporary?: boolean
  supportAuras?: Array<{ type: string; [key: string]: unknown }>
  [key: string]: unknown
}

export type CombatReplayUnit = CombatSnapshotUnit

export interface CombatEvent {
  type: string
  unitId?: string
  sourceId?: string
  targetId?: string
  x?: number
  y?: number
  amount?: number
  details?: Record<string, unknown>
  [key: string]: unknown
}

export * from './replay.inventory.js'
