import { Container, Graphics } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import type { MapLocation, GridCoord, GridSize } from '@/domains/map/map.types'
import { isCellInBounds, worldToCell } from '@/domains/map/map.grid'

export interface InteractionManager {
  setSelectedLocation(loc: MapLocation | null): void
  updateLocations(locations: MapLocation[]): void
  destroy(): void
}

export function setupMapInteraction(
  viewport: Viewport,
  interactionLayer: Container,
  locations: MapLocation[],
  cellWorldSize: number,
  mapSize: GridSize,
  onSelect: (location: MapLocation | null) => void
): InteractionManager {
  let locationMap = new Map<string, MapLocation>()
  function rebuildMap(locs: MapLocation[]) {
    locationMap = new Map()
    for (const l of locs) {
      locationMap.set(`${l.x},${l.y}`, l)
    }
  }
  rebuildMap(locations)

  const highlightGraphic = new Graphics()
  interactionLayer.addChild(highlightGraphic)

  let selectedCoord: GridCoord | null = null

  function redrawHighlight() {
    highlightGraphic.clear()
    if (!selectedCoord) return

    const x = selectedCoord.x * cellWorldSize
    const y = selectedCoord.y * cellWorldSize

    highlightGraphic
      .rect(x + 2, y + 2, cellWorldSize - 4, cellWorldSize - 4)
      .fill({ color: 0xe68a00, alpha: 0.15 })
      .stroke({ color: 0xffaa22, width: 2, alpha: 0.85 })
  }

  const onViewportClicked = (event: { world: { x: number; y: number } }) => {
    const cell = worldToCell(event.world.x, event.world.y, cellWorldSize)
    if (!isCellInBounds(cell, mapSize)) {
      selectedCoord = null
      redrawHighlight()
      onSelect(null)
      return
    }

    selectedCoord = cell
    redrawHighlight()

    const loc = locationMap.get(`${cell.x},${cell.y}`) ?? null
    onSelect(loc)
  }

  viewport.on('clicked', onViewportClicked)

  return {
    setSelectedLocation(loc: MapLocation | null) {
      if (loc) {
        selectedCoord = { x: loc.x, y: loc.y }
      } else {
        selectedCoord = null
      }
      redrawHighlight()
    },
    updateLocations(newLocs: MapLocation[]) {
      rebuildMap(newLocs)
    },
    destroy() {
      viewport.off('clicked', onViewportClicked)
      highlightGraphic.destroy()
    }
  }
}
