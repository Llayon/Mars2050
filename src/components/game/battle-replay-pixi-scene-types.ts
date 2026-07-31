import type { Container, Graphics, Sprite, Text } from 'pixi.js'
import type { FloatingText } from './battle-replay-canvas-types'
import type { ReplayCrowdRenderWorkspace } from './battle-replay-density-workspace'

export interface PixiUnitDisplay {
  renderFrame: number
  layer: Container
  flash: Graphics
  fallback: Graphics
  sprite: Sprite
  label: Text
  emp: Text
  air: Text
  hp: Graphics
  hitbox: Graphics
  velocity: Graphics
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
  hazards: Graphics[]
  clusters: Map<string, PixiClusterDisplay>
  clusterDisplays: PixiClusterDisplay[]
  projectiles: Graphics[]
  targetLines: Graphics[]
  texts: Text[]
  units: Map<string, PixiUnitDisplay>
  unitDisplays: PixiUnitDisplay[]
  crowdWorkspace: ReplayCrowdRenderWorkspace
  selectedTexts: FloatingText[]
  floatingTextBuckets: Set<number>
}
