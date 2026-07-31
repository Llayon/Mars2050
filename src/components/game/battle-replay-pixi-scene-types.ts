import type { Container, Graphics, Sprite, Text } from 'pixi.js'
import type { FloatingText } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderWorkspace } from './battle-replay-density-workspace'
import type { PixiUnitRenderState } from './battle-replay-pixi-unit-state'
import type { PixiUnitOptionalPool } from './battle-replay-pixi-unit-pool'

export interface PixiUnitDisplay {
  renderFrame: number
  layer: Container
  flash: Graphics | null
  fallback: Graphics | null
  sprite: Sprite
  label: Text | null
  emp: Text | null
  air: Text | null
  hpBackground: Sprite
  hpFill: Sprite
  hitbox: Graphics | null
  velocity: Graphics | null
  state: PixiUnitRenderState
}

export interface PixiClusterDisplay {
  renderFrame: number
  graphic: Graphics
}

export interface PixiReplayScene {
  renderFrame: number
  root: Container
  fieldLayer: Container
  hazardLayer: Container
  clusterLayer: Container
  projectileLayer: Container
  unitLayer: Container
  targetLayer: Container
  textLayer: Container
  unitPoolLayer: Container
  hazards: Graphics[]
  clusters: Map<string, PixiClusterDisplay>
  clusterDisplays: PixiClusterDisplay[]
  projectiles: Graphics[]
  targetLines: Graphics[]
  texts: Text[]
  units: Map<string, PixiUnitDisplay>
  unitDisplays: PixiUnitDisplay[]
  unitOptionalPool: PixiUnitOptionalPool
  crowdWorkspace: ReplayCrowdRenderWorkspace
  selectedTexts: FloatingText[]
  floatingTextBuckets: Set<number>
}
