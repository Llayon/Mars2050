import { Application, Container } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { DEFAULT_MAP_SEED } from '@/domains/map/map.config'
import type { MapLocation, GridSize } from '@/domains/map/map.types'
import { calculateGridWorldBounds, getMapRenderResolution } from './mars-map-projection'
import { loadMapAssets } from './mars-map-assets'
import { buildContinuousGround, populateGroundDecals } from './mars-map-ground'
import { populateMacroTerrain, populateScatterTerrain } from './mars-map-terrain'
import { generateTerrainVisualField } from './mars-terrain-field'
import { setupMapInteraction } from './mars-map-interaction'
import {
  DEFAULT_TERRAIN_LIGHTING,
  isTerrainCertificationEnabled,
  terrainDebugModeToShaderId,
  type TerrainDebugMode,
  type TerrainLightingMode
} from './mars-map-lighting'
import { TerrainLightingContext } from './mars-map-lit-mesh'

export interface MarsMapRuntimeOptions {
  container: HTMLElement
  locations: MapLocation[]
  selectedLocation: MapLocation | null
  mapSize?: GridSize
  terrainSeed?: number
  terrainLightingMode?: TerrainLightingMode
  terrainDebugMode?: TerrainDebugMode
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
    terrainSeed = DEFAULT_MAP_SEED,
    terrainLightingMode = 'enhanced',
    terrainDebugMode = 'off',
    onSelectLocation
  } = options

  const assets = await loadMapAssets()
  const cellWorldSize = assets.manifest.profile.cellWorldSize

  const app = new Application()
  await app.init({
    preference: 'webgl',
    resizeTo: container,
    backgroundColor: 0x110a08,
    antialias: true,
    resolution: getMapRenderResolution(typeof window !== 'undefined' ? window.devicePixelRatio : 1),
    autoDensity: true
  })
  container.appendChild(app.canvas)

  const worldBounds = calculateGridWorldBounds(mapSize.width, mapSize.height, cellWorldSize)

  const viewport = new Viewport({
    screenWidth: container.clientWidth,
    screenHeight: container.clientHeight,
    worldWidth: worldBounds.width,
    worldHeight: worldBounds.height,
    events: app.renderer.events
  })

  app.stage.addChild(viewport)

  viewport
    .drag()
    .pinch()
    .wheel()
    .decelerate()
    .clamp({
      left: worldBounds.minX - 256,
      top: worldBounds.minY - 256,
      right: worldBounds.maxX + 256,
      bottom: worldBounds.maxY + 256
    })
    .clampZoom({
      minScale: 0.35,
      maxScale: 2.5
    })

  viewport.moveCenter(worldBounds.width / 2, worldBounds.height / 2)

  // Layer hierarchy under worldRoot
  const worldRoot = new Container()
  viewport.addChild(worldRoot)

  const groundLayer = new Container()
  const groundDecalLayer = new Container()
  const macroLayer = new Container()
  macroLayer.sortableChildren = true
  const scatterLayer = new Container()
  scatterLayer.sortableChildren = true
  const interactionLayer = new Container()

  worldRoot.addChild(groundLayer)
  worldRoot.addChild(groundDecalLayer)
  worldRoot.addChild(macroLayer)
  worldRoot.addChild(scatterLayer)
  worldRoot.addChild(interactionLayer)

  // Generate deterministic visual terrain field
  const terrainField = generateTerrainVisualField({
    width: mapSize.width,
    height: mapSize.height,
    seed: terrainSeed
  })

  const occupiedCells = new Set<string>()

  // Instantiate shared lighting context if enhanced lighting is active and assets available
  const debugShaderId = terrainDebugModeToShaderId(terrainDebugMode)
  const lightingContext =
    terrainLightingMode !== 'baked' && assets.lightingAvailable
      ? new TerrainLightingContext(assets.manifest.profile, DEFAULT_TERRAIN_LIGHTING, debugShaderId)
      : null

  // Populate terrain layers
  buildContinuousGround(groundLayer, worldBounds, terrainField, cellWorldSize)
  populateGroundDecals(groundDecalLayer, worldBounds, terrainField, assets, cellWorldSize, lightingContext, terrainLightingMode)
  populateMacroTerrain(macroLayer, locations, terrainField, assets, cellWorldSize, occupiedCells, lightingContext, terrainLightingMode)
  populateScatterTerrain(scatterLayer, terrainField, assets, cellWorldSize, occupiedCells, lightingContext, terrainLightingMode)

  // Attach diagnostic state for certification when explicitly enabled
  const certEnabled = isTerrainCertificationEnabled()
  if (certEnabled) {
    (window as unknown as Record<string, unknown>).__MARS_MAP_DIAGNOSTICS__ = {
      lightingMode: terrainLightingMode,
      debugMode: terrainDebugMode,
      lightingAvailable: assets.lightingAvailable,
      rendererResolution: app.renderer.resolution,
      rendererType: app.renderer.name,
      atlasPages: assets.albedoPages.length,
      groundDecals: groundDecalLayer.children.length,
      macroCount: macroLayer.children.length,
      scatterCount: scatterLayer.children.length
    }
  }

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
      const refreshedOccupied = new Set<string>()
      populateMacroTerrain(macroLayer, newLocs, terrainField, assets, cellWorldSize, refreshedOccupied, lightingContext, terrainLightingMode)
    },
    setSelectedLocation(loc: MapLocation | null) {
      interaction.setSelectedLocation(loc)
    },
    destroy() {
      if (certEnabled) {
        delete (window as unknown as Record<string, unknown>).__MARS_MAP_DIAGNOSTICS__
      }
      resizeObserver.disconnect()
      interaction.destroy()
      const canvas = app.canvas
      try {
        app.ticker.stop()
        app.ticker.destroy()
        app.destroy(true, { children: true, texture: false, textureSource: false })
      } catch {}
      if (canvas && container.contains(canvas)) {
        try {
          container.removeChild(canvas)
        } catch {}
      }
    }
  }
}
