'use client'

import { Application, extend } from '@pixi/react'
import { Container, Graphics, Sprite, Text, Ticker } from 'pixi.js'
import { Viewport as PixiViewport } from 'pixi-viewport'
import { useEffect, useRef, useState, useCallback } from 'react'
import { RENDER_LIMITS } from '@/domains/building/building.config'
import { gridToScreen } from '@/domains/building/building.isometric'

// Register PixiJS elements for JSX
extend({ Container, Graphics, Sprite, Text, PixiViewport })

interface TelegramWebApp {
  expand: () => void
  disableVerticalSwipes: () => void
  lockOrientation: (orientation: 'portrait' | 'landscape') => void
}

export default function ColonyCanvas() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const getTelegramApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      const tg = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } }).Telegram?.WebApp
      return tg || null
    }
    return null
  }, [])

  useEffect(() => {
    const tg = getTelegramApp()
    if (tg) {
      tg.expand()
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes()
      if (tg.lockOrientation) tg.lockOrientation('portrait')
    }

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [getTelegramApp])

  if (dimensions.width === 0) return null

  return (
    <div ref={containerRef} className="w-full h-full">
      <Application
        width={dimensions.width}
        height={dimensions.height}
        background="#000000"
        antialias={true}
        resolution={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
      >
        <pixiViewport
          width={dimensions.width}
          height={dimensions.height}
          worldWidth={RENDER_LIMITS.MAP_SIZE * RENDER_LIMITS.TILE_WIDTH}
          worldHeight={RENDER_LIMITS.MAP_SIZE * RENDER_LIMITS.TILE_HEIGHT}
          events={Ticker.shared}
          init={(viewport: PixiViewport) => {
            viewport
              .drag()
              .pinch()
              .wheel()
              .decelerate()
              .clamp({ direction: 'all' })
              .clampZoom({ minScale: 0.5, maxScale: 2 })
          }}
        >
          <DebugGrid />
        </pixiViewport>
      </Application>
    </div>
  )
}

function DebugGrid() {
  const { MAP_SIZE } = RENDER_LIMITS
  
  const drawGrid = useCallback((g: Graphics) => {
    g.clear()
    g.setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.5 })

    for (let i = 0; i <= MAP_SIZE; i++) {
      const startX = gridToScreen(i, 0)
      const endX = gridToScreen(i, MAP_SIZE)
      g.moveTo(startX.x, startX.y)
      g.lineTo(endX.x, endX.y)

      const startY = gridToScreen(0, i)
      const endY = gridToScreen(MAP_SIZE, i)
      g.moveTo(startY.x, startY.y)
      g.lineTo(endY.x, endY.y)
    }
    g.stroke()
  }, [MAP_SIZE])

  return (
    <pixiContainer>
      <pixiGraphics draw={drawGrid} />
    </pixiContainer>
  )
}
