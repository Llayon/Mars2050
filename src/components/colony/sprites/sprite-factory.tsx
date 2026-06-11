import { useMemo, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import type { BuildingRow } from '@/domains/building/building.types'
import { gridToScreen, calculateZIndex } from '@/domains/building/building.isometric'
import { RENDER_LIMITS } from '@/domains/building/building.config'

interface SpriteFactoryProps {
  buildings: BuildingRow[]
}

// Temporary color mapping for placeholders
const TYPE_COLORS: Record<string, number> = {
  solar_panels: 0xFFD700, // Yellow
  oxygen_generator: 0x87CEEB, // Light Blue
  water_extractor: 0x4169E1, // Royal Blue
  mine: 0x8B4513, // Saddle Brown
  greenhouse: 0x32CD32, // Lime Green
  research_lab: 0x9370DB, // Medium Purple
}

export function SpriteFactory({ buildings }: SpriteFactoryProps) {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS

  // We use useMemo to avoid recreating the graphics array on every tiny render unless buildings change
  const renderedBuildings = useMemo(() => {
    // Enforce rendering limits
    const buildingsToRender = buildings.slice(0, RENDER_LIMITS.MAX_SPRITES)

    return buildingsToRender.map((building) => {
      const pos = gridToScreen(building.x, building.y)
      const zIndex = calculateZIndex(building.x, building.y)
      const color = TYPE_COLORS[building.type] || 0xFFFFFF

      // Using PixiJS v8 syntax (fill/stroke)
      const drawPlaceholder = (g: PIXI.Graphics) => {
        g.clear()

        // Draw an isometric "box" placeholder
        // Base (Diamond)
        g.moveTo(0, -TILE_HEIGHT / 2)
        g.lineTo(TILE_WIDTH / 2, 0)
        g.lineTo(0, TILE_HEIGHT / 2)
        g.lineTo(-TILE_WIDTH / 2, 0)
        g.closePath()
        g.fill({ color, alpha: 0.8 })
        g.stroke({ width: 1, color: 0x000000, alpha: 0.5 })

        // Height (Cube) - just a simple rectangle going up
        g.rect(-TILE_WIDTH/4, -TILE_HEIGHT, TILE_WIDTH/2, TILE_HEIGHT)
        g.fill({ color, alpha: 0.6 })
      }

      return (
        <pixiGraphics
          key={building.id}
          x={pos.x}
          y={pos.y}
          zIndex={zIndex}
          draw={drawPlaceholder}
        />
      )
    })
  }, [buildings, TILE_WIDTH, TILE_HEIGHT])

  return (
    <pixiContainer sortableChildren={true}>
      {renderedBuildings}
    </pixiContainer>
  )
}
