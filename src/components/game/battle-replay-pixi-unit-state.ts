import type { ReplayTeam } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderMode } from './battle-replay-density'
import {
  createPixiReplaySpriteState,
  type PixiReplaySpriteState,
} from './battle-replay-pixi-sprites'

interface FallbackState {
  hasGeometry: boolean
  team: ReplayTeam | null
  radius: number
  mode: ReplayCrowdRenderMode | null
  airTarget: boolean
  flashing: boolean
}

interface HpState {
  visible: boolean
  ratio: number
  team: ReplayTeam | null
  y: number
}

interface FlashState {
  hasGeometry: boolean
  visible: boolean
  radius: number
  alpha: number
}

interface HitboxState {
  hasGeometry: boolean
  visible: boolean
  team: ReplayTeam | null
  radius: number
}

interface VelocityState {
  hasGeometry: boolean
  visible: boolean
  dx: number
  dy: number
}

interface StatusState {
  labelVisible: boolean
  labelType: string
  empVisible: boolean
  airVisible: boolean
  radius: number
}

export interface PixiUnitRenderState {
  sprite: PixiReplaySpriteState
  fallback: FallbackState
  hp: HpState
  flash: FlashState
  hitbox: HitboxState
  velocity: VelocityState
  status: StatusState
}

export function createPixiUnitRenderState(): PixiUnitRenderState {
  return {
    sprite: createPixiReplaySpriteState(),
    fallback: {
      hasGeometry: false,
      team: null,
      radius: -1,
      mode: null,
      airTarget: false,
      flashing: false,
    },
    hp: { visible: false, ratio: -1, team: null, y: Number.NaN },
    flash: {
      hasGeometry: false,
      visible: false,
      radius: -1,
      alpha: -1,
    },
    hitbox: {
      hasGeometry: false,
      visible: false,
      team: null,
      radius: -1,
    },
    velocity: {
      hasGeometry: false,
      visible: false,
      dx: Number.NaN,
      dy: Number.NaN,
    },
    status: {
      labelVisible: false,
      labelType: '',
      empVisible: false,
      airVisible: false,
      radius: -1,
    },
  }
}
