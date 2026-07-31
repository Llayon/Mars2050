import type { BattleTick, Obstacle, SimUnit, UnitRow } from '@/domains/combat/combat.types'
import type { ReplayRenderProfileSnapshot } from './battle-replay-profile'

export interface ReplayControls {
  play: () => void
  pause: () => void
  seekToTick: (tick: number) => void
  stepTick: () => void
  getCurrentTick: () => number
  getTotalTicks: () => number
  setSpeed: (s: number) => void
  setOverlays: (o: OverlayState) => void
}

export type ReplayRendererMode = 'canvas' | 'pixi'

export type BattleReplayEngineProps = {
  container: HTMLDivElement
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  initialState?: SimUnit[]
  logs: BattleTick[]
  obstacles?: Obstacle[]
  onTickChange?: (tick: number) => void
  rendererMode?: ReplayRendererMode
}

export type ReplayAppHandle = {
  canvas: HTMLCanvasElement
  destroy: () => void
  getPerformanceProfile: () => ReplayRenderProfileSnapshot | null
}

export type OverlayState = {
  radius: boolean
  velocity: boolean
  targets: boolean
}

export type ReplayTeam = 'attacker' | 'defender'
export type UnitSize = 'S' | 'M' | 'L' | 'XL'
export type ReplayVisualClip = 'idle' | 'walk' | 'attack' | 'death'
export type ReplayVisualDirection =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'north-east'
  | 'north-west'
  | 'south-east'
  | 'south-west'

export interface ReplayUnitVisualState {
  facing: ReplayVisualDirection
  clipStartedAtMs: number
  attackStartedAtMs: number | null
  deathStartedAtMs: number | null
  lastMovementAtMs: number | null
}

export type ReplayUnit = {
  id: string
  type: string
  team: ReplayTeam
  hp: number
  maxHp: number
  size: UnitSize
  sX: number
  sY: number
  tX: number
  tY: number
  isDead: boolean
  isFlying: boolean
  mobilityMode?: string
  emp: boolean
  stealth: boolean
  flash: number
  deathAgeMs?: number
  visual: ReplayUnitVisualState
}

export type FloatingText = { text: string; x: number; y: number; color: string; age: number }
export type Projectile = { x1: number; y1: number; x2: number; y2: number; color: string; age: number }
export type HazardFx = { x: number; y: number; radius: number; color: string; label: string; age: number }

export const TICK_MS = 150
export const FLOAT_MS = 950
export const PROJECTILE_MS = 280
export const HAZARD_MS = 2400
