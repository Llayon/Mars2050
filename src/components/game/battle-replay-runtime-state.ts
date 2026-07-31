import type {
  FloatingText,
  HazardFx,
  OverlayState,
  Projectile,
  ReplayControls,
  ReplayUnit,
} from './battle-replay-canvas-types'

export interface ReplayFrameState {
  units: Record<string, ReplayUnit>
  unitList: ReplayUnit[]
  hazards: HazardFx[]
  projectiles: Projectile[]
  texts: FloatingText[]
  overlays: OverlayState
  progress: number
}

export interface BattleReplayRuntime {
  controls: ReplayControls
  frame: (now: number) => ReplayFrameState
  snapshot: () => ReplayFrameState
}
