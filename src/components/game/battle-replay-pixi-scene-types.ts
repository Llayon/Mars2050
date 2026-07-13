import type { Container, Graphics, Sprite, Text } from 'pixi.js'

export interface PixiUnitDisplay {
  layer: Container
  base: Graphics
  flash: Graphics
  fallback: Graphics
  sprite: Sprite
  ring: Graphics
  label: Text
  emp: Text
  air: Text
  hp: Graphics
  hitbox: Graphics
  velocity: Graphics
}

export interface PixiReplayScene {
  root: Container
  fieldLayer: Container
  hazardLayer: Container
  clusterLayer: Container
  projectileLayer: Container
  unitLayer: Container
  targetLayer: Container
  textLayer: Container
  hazards: Graphics[]
  clusters: Map<string, Graphics>
  projectiles: Graphics[]
  targetLines: Graphics[]
  texts: Text[]
  units: Map<string, PixiUnitDisplay>
}
