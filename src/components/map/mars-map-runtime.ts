import { Application, Container } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import type { MapLocation, GridSize } from '@/domains/map/map.types'
import { calculateGridWorldBounds } from './mars-map-projection'
import { loadMapAssets } from './mars-map-assets'
import { buildContinuousGround } from './mars-map-ground'
import { populateMacroTerrain, populateScatterTerrain } from './mars-map-terrain'
import { setupMapInteraction, type InteractionManager } from './mars-map-interaction'
import type { MapRenderScene } from './mars-map-render.types'

export interface MarsMapRuntimeOptions {
  container: HTMLElement
  locations: MapLocation[]
  selectedLocation: MapLocation | null
  mapSize?: GridSize
  onSelectLocation: (loc: MapLocation | null) => void
}

export interface MarsMapRuntime {
  updateLocations(locations: MapLocation[]): void
  setSelectedLocation(loc: MapLocation | null): void
  destroy(): void
}

export async function createMarsMapRuntime(
  options: MarsMapRuntimeOptions
): Promise<MarsMapRuntime> {
  const {
    container,
    locations,
    selectedLocation,
    mapSize = { width: 20, height: 20 },
    onSelectLocation
  } = options

  const app = new Application()
  await app.init({
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
    background: '#0d0d11',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
  })

  container.appendChild(app.canvas)

  const assets = await loadMapAssets('/assets/map/terrain-manifest.json')
  const cellWorldSize = assets.manifest.profile.cellWorldSize
  const worldBounds = calculateGridWorldBounds(mapSize.width, mapSize.height, cellWorldSize)

  const viewport = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    worldWidth: worldBounds.width,
    worldHeight: worldBounds.height,
    events: app.renderer.events
  })
  app.stage.addChild(viewport)

  viewport
    .drag({ pressDrag: true })
    .pinch()
    .wheel()
    .decelerate()

  viewport.clampZoom({
    minScale: 0.25,
    maxScale: 2.0
  })

  viewport.clamp({
    left: -200,
    right: worldBounds.width + 200,
    top: -200,
    bottom: worldBounds.height + 200,
    underflow: 'center'
  })

  // Fit and center world in view
  viewport.fitWorld(true)
  viewport.moveCenter(worldBounds.width / 2, worldBounds.height / 2)

  // Layer hierarchy under worldRoot
  const worldRoot = new Container()
  viewport.addChild(worldRoot)

  const groundLayer = new Container()
  const macroLayer = new Container()
  macroLayer.sortableChildren = true
  const scatterLayer = new Container()
  scatterLayer.sortableChildren = true
  const interactionLayer = new Container()

  worldRoot.addChild(groundLayer)
  worldRoot.addChild(macroLayer)
  worldRoot.addChild(scatterLayer)
  worldRoot.addChild(interactionLayer)

  // Populate terrain layers
  buildContinuousGround(groundLayer, worldBounds)
  populateMacroTerrain(macroLayer, locations, assets, cellWorldSize)
  populateScatterTerrain(scatterLayer, mapSize.width, mapSize.height, assets, cellWorldSize)

  // Setup interaction
  const interaction = setupMapInteraction(
    viewport,
    interactionLayer,
    locations,
    cellWorldSize,
    mapSize,
    onSelectLocation
  )

  if (selectedLocation) {
    interaction.setSelectedLocation(selectedLocation)
  }

  // Handle ResizeObserver
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        app.renderer.resize(width, height)
        viewport.resize(width, height)
      }
    }
  })
  resizeObserver.observe(container)

  return {
    updateLocations(newLocs: MapLocation[]) {
      interaction.updateLocations(newLocs)
      macroLayer.removeChildren()
      populateMacroTerrain(macroLayer, newLocs, assets, cellWorldSize)
    },
    setSelectedLocation(loc: MapLocation | null) {
      interaction.setSelectedLocation(loc)
    },
    destroy() {
      resizeObserver.disconnect()
      interaction.destroy()
      viewport.destroy({ children: true })
      try {
        app.destroy(true, { children: true, texture: false })
      } catch {}
      if (container.contains(app.canvas)) {
        container.removeChild(app.canvas)
      }
    }
  }
}
