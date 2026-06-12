'use client'

import * as PIXI from 'pixi.js'
import { useEffect, useRef } from 'react'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS } from '@/domains/building/building.config'

/**
 * Enhanced Colony Canvas with manual Panning and Isometric visuals.
 */
export default function ColonyCanvas({ 
  buildings, 
  onBuildingClick,
  placementMode,
  onConfirmPlacement
}: { 
  buildings: BuildingRow[]
  onBuildingClick: (building: BuildingRow) => void 
  placementMode: BuildingTypeKey | null
  onConfirmPlacement: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const worldRef = useRef<PIXI.Container | null>(null)
  
  // State for panning
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const startDragPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    
    let app: PIXI.Application | null = null

    const initPixi = async () => {
      try {
        app = new PIXI.Application()
        appRef.current = app

        const width = containerRef.current?.clientWidth || 800
        const height = containerRef.current?.clientHeight || 600

        await app.init({
          width,
          height,
          background: '#121212',
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })

        if (!containerRef.current) return
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(app.canvas)

        // --- WORLD CONTAINER ---
        const world = new PIXI.Container()
        worldRef.current = world
        
        // Initial center focus (buildings are at 10,10 which is x:0, y:320 screen)
        world.x = app.screen.width / 2
        world.y = app.screen.height / 2 - 320
        app.stage.addChild(world)

        // --- GRID 20x20 ---
        const { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
        const grid = new PIXI.Graphics()
        grid.setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.8 })
        
        for (let i = 0; i <= MAP_SIZE; i++) {
          const s1 = gridToScreen(i, 0); const e1 = gridToScreen(i, MAP_SIZE)
          grid.moveTo(s1.x, s1.y).lineTo(e1.x, e1.y)
          const s2 = gridToScreen(0, i); const e2 = gridToScreen(MAP_SIZE, i)
          grid.moveTo(s2.x, s2.y).lineTo(e2.x, e2.y)
        }
        grid.stroke()
        world.addChild(grid)

                // --- BUILDINGS ---
        const TYPE_COLORS: Record<string, number> = {
          solar_panels: 0xFFD700, oxygen_generator: 0x00CCFF, water_extractor: 0x3366FF,
          mine: 0x996633, greenhouse: 0x33FF33, research_lab: 0xCC33FF,
        }

        buildings.forEach(b => {
          // Add 0.5 offset to place building in the center of the tile
          const pos = gridToScreen(b.x + 0.5, b.y + 0.5)
          const buildingCont = new PIXI.Container()
          buildingCont.x = pos.x; buildingCont.y = pos.y
          
          const color = TYPE_COLORS[b.type] || 0xcccccc
          const graphics = new PIXI.Graphics()
          const h = 30; const w2 = TILE_WIDTH / 2; const h2 = TILE_HEIGHT / 2
          
          // 1. Shadow (Ellipse on ground)
          graphics.ellipse(0, 0, w2 * 0.8, h2 * 0.8)
          graphics.fill({ color: 0x000000, alpha: 0.2 })

          // 2. Left Face (Darkest)
          graphics.moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath()
          graphics.fill({ color: color, alpha: 0.6 })

          // 3. Right Face (Medium)
          graphics.moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath()
          graphics.fill({ color: color, alpha: 0.8 })

          // 4. Top Face (Brightest)
          graphics.moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath()
          graphics.fill({ color: color, alpha: 1 })
          graphics.stroke({ width: 1, color: 0xffffff, alpha: 0.5 })

          buildingCont.addChild(graphics)

          // Label (Adjusted position)
          const label = new PIXI.Text({
            text: b.name.split(' ')[0],
            style: { 
              fill: '#ffffff', 
              fontSize: 10, 
              fontWeight: 'bold', 
              stroke: { color: '#000000', width: 2 } 
            }
          })
          label.anchor.set(0.5)
          label.y = -h - 15
          buildingCont.addChild(label)
          
          // Interactions
          buildingCont.eventMode = 'static'
          buildingCont.cursor = 'pointer'
          buildingCont.on('pointerup', (e) => {
            const dx = e.global.x - startDragPos.current.x
            const dy = e.global.y - startDragPos.current.y
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) onBuildingClick(b)
          })
          
          world.addChild(buildingCont)
        })

        // --- PLACEMENT GHOST ---
        let ghostGraphics: PIXI.Graphics | null = null; let ghostValid = false;
        let ghostGridX = 0, ghostGridY = 0;

        if (placementMode) {
          ghostGraphics = new PIXI.Graphics(); ghostGraphics.zIndex = 9999
          world.addChild(ghostGraphics)

          const updateGhost = (e: PIXI.FederatedPointerEvent) => {
            if (!ghostGraphics) return
            const localPos = world.toLocal(e.global)
            const snapped = screenToGrid(localPos.x, localPos.y)
            ghostGridX = snapped.x; ghostGridY = snapped.y
            
            const { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
            let valid = snapped.x >= 0 && snapped.x < MAP_SIZE && snapped.y >= 0 && snapped.y < MAP_SIZE
            if (valid && buildings.some(b => b.x === snapped.x && b.y === snapped.y)) valid = false
            ghostValid = valid

            const pos = gridToScreen(snapped.x + 0.5, snapped.y + 0.5)
            ghostGraphics.x = pos.x; ghostGraphics.y = pos.y

            const color = valid ? 0x00ff00 : 0xff0000
            const w2 = TILE_WIDTH / 2; const h2 = TILE_HEIGHT / 2
            
            ghostGraphics.clear()
            ghostGraphics.moveTo(0, -h2 - 20).lineTo(w2, -20).lineTo(0, h2 - 20).lineTo(-w2, -20).closePath()
            ghostGraphics.fill({ color, alpha: 0.5 }).stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
            ghostGraphics.rect(-w2, -20, w2, 20).fill({ color, alpha: 0.3 })
            ghostGraphics.rect(0, -20, w2, 20).fill({ color, alpha: 0.2 })
          }

          app.stage.on('pointermove', updateGhost)
          updateGhost({ global: { x: app.screen.width/2, y: app.screen.height/2 } } as unknown as PIXI.FederatedPointerEvent)
        }

        // --- INTERACTION: PANNING ---
        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen
        
        app.stage.on('pointerdown', (e) => {
          isDragging.current = true
          lastPos.current = { x: e.global.x, y: e.global.y }
          startDragPos.current = { x: e.global.x, y: e.global.y }
        })
        
        app.stage.on('pointerup', (e) => {
          if (placementMode && ghostValid) {
            const dx = e.global.x - startDragPos.current.x
            const dy = e.global.y - startDragPos.current.y
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
               onConfirmPlacement(ghostGridX, ghostGridY)
            }
          }
          isDragging.current = false 
        })
        app.stage.on('pointerupoutside', () => { isDragging.current = false })
        
        app.stage.on('pointermove', (e) => {
          if (isDragging.current && worldRef.current) {
            const dx = e.global.x - lastPos.current.x
            const dy = e.global.y - lastPos.current.y
            
            worldRef.current.x += dx
            worldRef.current.y += dy
            
            lastPos.current = { x: e.global.x, y: e.global.y }
            
            // If we moved significantly, cancel click intent
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
               // Click cancellation handled by threshold
            }
          }
        })

      } catch (err) {
        console.error('[Pixi] Error:', err)
      }
    }

    initPixi()

    return () => {
      if (app) app.destroy(true, { children: true, texture: true })
    }
  }, [buildings, onBuildingClick, placementMode, onConfirmPlacement])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[500px] bg-[#111111] overflow-hidden cursor-move"
    />
  )
}