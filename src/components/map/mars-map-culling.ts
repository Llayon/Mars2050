import { Container } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'

export interface RuntimeTerrainLayerStack {
  worldRoot: Container
  groundLayer: Container
  surfaceDetailLayer: Container
  formationGroundLayer: Container
  macroLayer: Container
  heroLayer: Container
  scatterLayer: Container
  microLayer: Container
  interactionLayer: Container
}

/**
 * Instantiates and builds the 8-tier container layer hierarchy for Mars terrain rendering.
 */
export function createTerrainLayerStack(viewport: Viewport): RuntimeTerrainLayerStack {
  const worldRoot = new Container()
  viewport.addChild(worldRoot)

  const groundLayer = new Container()
  const surfaceDetailLayer = new Container()
  surfaceDetailLayer.sortableChildren = true
  const formationGroundLayer = new Container()
  formationGroundLayer.sortableChildren = true
  const macroLayer = new Container()
  macroLayer.sortableChildren = true
  const heroLayer = new Container()
  heroLayer.sortableChildren = true
  const scatterLayer = new Container()
  scatterLayer.sortableChildren = true
  const microLayer = new Container()
  microLayer.sortableChildren = true
  const interactionLayer = new Container()

  worldRoot.addChild(groundLayer)
  worldRoot.addChild(surfaceDetailLayer)
  worldRoot.addChild(formationGroundLayer)
  worldRoot.addChild(macroLayer)
  worldRoot.addChild(heroLayer)
  worldRoot.addChild(scatterLayer)
  worldRoot.addChild(microLayer)
  worldRoot.addChild(interactionLayer)

  return {
    worldRoot,
    groundLayer,
    surfaceDetailLayer,
    formationGroundLayer,
    macroLayer,
    heroLayer,
    scatterLayer,
    microLayer,
    interactionLayer
  }
}

/**
 * Attaches lightweight viewport AABB culling and micro-scatter zoom LOD to the viewport.
 */
export function setupMapCullingAndLod(
  viewport: Viewport,
  layersToCull: Container[],
  microLayer: Container,
  cellWorldSize: number
): void {
  const cullMargin = cellWorldSize * 1.5

  const update = () => {
    // Micro scatter LOD: cut fine pebbles at low zoom
    microLayer.visible = viewport.scale.x >= 0.55

    const vBounds = viewport.getVisibleBounds()
    const minX = vBounds.x - cullMargin
    const minY = vBounds.y - cullMargin
    const maxX = vBounds.x + vBounds.width + cullMargin
    const maxY = vBounds.y + vBounds.height + cullMargin

    for (const layer of layersToCull) {
      if (!layer.visible) continue
      for (const child of layer.children) {
        const cx = child.position.x
        const cy = child.position.y
        child.renderable = cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
      }
    }
  }

  viewport.on('moved', update)
  viewport.on('zoomed', update)
  update()
}
