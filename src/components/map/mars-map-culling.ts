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

export interface TerrainCullBounds {
  halfWidth: number
  halfHeight: number
}

/**
 * Pure helper for testing AABB intersection between an object with conservative extents
 * and an expanded viewport rectangle.
 */
export function isItemInViewportAabb(
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  const left = x - halfW
  const right = x + halfW
  const top = y - halfH
  const bottom = y + halfH
  return right >= minX && left <= maxX && bottom >= minY && top <= maxY
}

/**
 * Attaches lightweight viewport conservative AABB culling and micro-scatter zoom LOD to the viewport.
 * Returns an update function allowing manual cull state recalculation after layer repopulation.
 */
export function setupMapCullingAndLod(
  viewport: Viewport,
  layersToCull: Container[],
  microLayer: Container,
  cellWorldSize: number
): () => void {
  const cullMargin = cellWorldSize * 0.75

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
        const bounds = (child as unknown as { cullBounds?: TerrainCullBounds }).cullBounds
        const halfW = bounds ? bounds.halfWidth : (cellWorldSize * 0.5)
        const halfH = bounds ? bounds.halfHeight : (cellWorldSize * 0.5)
        child.renderable = isItemInViewportAabb(
          child.position.x,
          child.position.y,
          halfW,
          halfH,
          minX,
          minY,
          maxX,
          maxY
        )
      }
    }
  }

  viewport.on('moved', update)
  viewport.on('zoomed', update)
  update()

  return update
}
