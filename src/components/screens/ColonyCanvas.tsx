'use client'

import * as PIXI from 'pixi.js'
import { useEffect, useRef } from 'react'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS, BUILDING_TYPES } from '@/domains/building/building.config'
import { ASSET_MANIFEST } from '@/components/colony/sprites/asset-manifest'

const TYPE_COLORS: Record<string, number> = {
  solar_panels: 0xFFD700, oxygen_generator: 0x00CCFF, water_extractor: 0x3366FF,
  mine: 0x996633, greenhouse: 0x33FF33, research_lab: 0xCC33FF,
}

/** Refactored building drawer to reduce main component size. */
function drawBuilding(b: BuildingRow, textures: Record<string, PIXI.Texture>) {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  const bConfig = BUILDING_TYPES[b.type]
  const bw = bConfig?.width || 1
  const bh = bConfig?.height || 1
  const buildingCont = new PIXI.Container()
  const pos = gridToScreen(b.x + bw / 2, b.y + bh / 2)
  buildingCont.x = pos.x; buildingCont.y = pos.y
  buildingCont.zIndex = (b.y + bh - 1) * 100 + (b.x + bw - 1)
  
  const texture = textures[b.type]
  if (texture) {
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5, 0.85)
    const targetWidth = TILE_WIDTH * bw * 1.5
    sprite.scale.set(targetWidth / sprite.width)
    buildingCont.addChild(sprite)
  } else {
    const color = TYPE_COLORS[b.type] || 0xcccccc
    const h = 30 * Math.max(bw, bh), w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2
    const g = new PIXI.Graphics()
    g.ellipse(0, 0, w2 * 0.8, h2 * 0.8).fill({ color: 0x000000, alpha: 0.2 })
    g.moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color, alpha: 0.6 })
    g.moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color, alpha: 0.8 })
    g.moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color, alpha: 1 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })
    buildingCont.addChild(g)
  }

  const label = new PIXI.Text({
    text: b.name.split(' ')[0],
    style: { fill: '#ffffff', fontSize: 10, fontWeight: 'bold', stroke: { color: '#000000', width: 2 } }
  })
  label.anchor.set(0.5); label.y = -45
  buildingCont.addChild(label)
  return buildingCont
}

export default function ColonyCanvas({ buildings, onBuildingClick, placementMode, onConfirmPlacement }: { 
  buildings: BuildingRow[]; onBuildingClick: (b: BuildingRow) => void 
  placementMode: BuildingTypeKey | null; onConfirmPlacement: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null), appRef = useRef<PIXI.Application | null>(null)
  const worldRef = useRef<PIXI.Container | null>(null), isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 }), startDragPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    let app: PIXI.Application | null = null
    const initPixi = async () => {
      try {
        app = new PIXI.Application(); appRef.current = app
        await app.init({ width: containerRef.current?.clientWidth || 800, height: containerRef.current?.clientHeight || 600, background: '#121212', antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
        if (!containerRef.current) return
        containerRef.current.innerHTML = ''; containerRef.current.appendChild(app.canvas)
        const loadedTextures: Record<string, PIXI.Texture> = {}
        for (const [t, p] of Object.entries(ASSET_MANIFEST)) { try { loadedTextures[t] = await PIXI.Assets.load(p) } catch {} }
        const world = new PIXI.Container(); world.sortableChildren = true; worldRef.current = world
        world.x = app.screen.width / 2; world.y = app.screen.height / 2 - 320; app.stage.addChild(world)
        const { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
        const grid = new PIXI.Graphics(); grid.setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.8 })
        for (let i = 0; i <= MAP_SIZE; i++) {
          const s1 = gridToScreen(i, 0); const e1 = gridToScreen(i, MAP_SIZE); grid.moveTo(s1.x, s1.y).lineTo(e1.x, e1.y)
          const s2 = gridToScreen(0, i); const e2 = gridToScreen(MAP_SIZE, i); grid.moveTo(s2.x, s2.y).lineTo(e2.x, e2.y)
        }
        grid.stroke(); grid.zIndex = -1; world.addChild(grid)

        buildings.forEach(b => {
          const cont = drawBuilding(b, loadedTextures)
          cont.eventMode = 'static'; cont.cursor = 'pointer'
          cont.on('pointerup', (e) => {
            if (Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onBuildingClick(b)
          })
          world.addChild(cont)
        })

        let ghostGraphics: PIXI.Graphics | null = null; let ghostValid = false; let ghostGridX = 0, ghostGridY = 0;
        if (placementMode) {
          ghostGraphics = new PIXI.Graphics(); ghostGraphics.zIndex = 9999; world.addChild(ghostGraphics)
          const updateGhost = (e: PIXI.FederatedPointerEvent) => {
            if (!ghostGraphics) return
            const lp = world.toLocal(e.global); const sn = screenToGrid(lp.x, lp.y)
            ghostGridX = sn.x; ghostGridY = sn.y;
            const bConfig = BUILDING_TYPES[placementMode]
            const bw = bConfig?.width || 1, bh = bConfig?.height || 1
            let v = sn.x >= 0 && (sn.x + bw) <= MAP_SIZE && sn.y >= 0 && (sn.y + bh) <= MAP_SIZE
            if (v) {
              const overlap = buildings.some(b => {
                const config = BUILDING_TYPES[b.type]
                const ew = config?.width || 1, eh = config?.height || 1
                return !(sn.x >= b.x + ew || sn.x + bw <= b.x || sn.y >= b.y + eh || sn.y + bh <= b.y)
              })
              if (overlap) v = false
            }
            ghostValid = v; const pos = gridToScreen(sn.x + bw / 2, sn.y + bh / 2)
            ghostGraphics.x = pos.x; ghostGraphics.y = pos.y
            const c = v ? 0x00ff00 : 0xff0000; const w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2, h = 30 * Math.max(bw, bh)
            ghostGraphics.clear()
            ghostGraphics.moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.3 })
            ghostGraphics.moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color: c, alpha: 0.4 })
            ghostGraphics.moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.5 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })
          }
          app.stage.on('pointermove', updateGhost)
          updateGhost({ global: { x: app.screen.width/2, y: app.screen.height/2 } } as unknown as PIXI.FederatedPointerEvent)
        }

        app.stage.eventMode = 'static'; app.stage.hitArea = app.screen
        app.stage.on('pointerdown', (e) => { isDragging.current = true; lastPos.current = { x: e.global.x, y: e.global.y }; startDragPos.current = { x: e.global.x, y: e.global.y } })
        app.stage.on('pointerup', (e) => {
          if (placementMode && ghostValid && Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onConfirmPlacement(ghostGridX, ghostGridY)
          isDragging.current = false 
        })
        app.stage.on('pointerupoutside', () => { isDragging.current = false })
        app.stage.on('pointermove', (e) => {
          if (isDragging.current && worldRef.current) {
            const dx = e.global.x - lastPos.current.x; const dy = e.global.y - lastPos.current.y
            worldRef.current.x += dx; worldRef.current.y += dy; lastPos.current = { x: e.global.x, y: e.global.y }
          }
        })
      } catch (err) { console.error('[Pixi] Error:', err) }
    }
    initPixi()
    return () => { if (app) app.destroy(true, { children: true, texture: true }) }
  }, [buildings, onBuildingClick, placementMode, onConfirmPlacement])

  return <div ref={containerRef} className="w-full h-full min-h-[500px] bg-[#111111] overflow-hidden cursor-move" />
}
