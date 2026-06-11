import React, { useMemo } from 'react'
import * as PIXI from 'pixi.js'
import type { BuildingRow } from '@/domains/building/building.types'
import { RENDER_LIMITS } from '@/domains/building/building.config'
import { gridToScreen, calculateZIndex } from '@/domains/building/building.isometric'

interface SpriteFactoryProps {
  buildings: BuildingRow[]
}

const COLORS: Record<string, number> = {
  solar_panels: 0xffd700,
  oxygen_generator: 0x87ceeb,
  water_extractor: 0x4682b4,
  mine: 0x8b4513,
  greenhouse: 0x228b22,
  research_lab: 0x9370db,
}

export const SpriteFactory: React.FC<SpriteFactoryProps> = ({ buildings }) => {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS

  const buildingsToRender = useMemo(() => {
    return buildings.slice(0, RENDER_LIMITS.MAX_SPRITES)
  }, [buildings])

  return (
    <pixiContainer sortableChildren={true}>
      {buildingsToRender.map((building) => {
        const { x, y } = gridToScreen(building.x, building.y)
        const zIndex = calculateZIndex(building.x, building.y)
        const color = COLORS[building.type] || 0xcccccc

        const drawPlaceholder = (g: PIXI.Graphics) => {
          g.clear()
          // Base (Diamond)
          g.moveTo(0, -TILE_HEIGHT / 2)
          g.lineTo(TILE_WIDTH / 2, 0)
          g.lineTo(0, TILE_HEIGHT / 2)
          g.lineTo(-TILE_WIDTH / 2, 0)
          g.closePath()
          g.fill({ color, alpha: 0.8 })
          g.stroke({ width: 1, color: 0x000000, alpha: 0.5 })

          // Height (Cube) - just a simple rectangle going up
          g.rect(-TILE_WIDTH / 4, -TILE_HEIGHT, TILE_WIDTH / 2, TILE_HEIGHT)
          g.fill({ color, alpha: 0.6 })
        }

        return (
          <pixiGraphics
            key={building.id}
            x={x}
            y={y}
            zIndex={zIndex}
            draw={drawPlaceholder}
          />
        )
      })}
    </pixiContainer>
  )
}
