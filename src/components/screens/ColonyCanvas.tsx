'use client'

import * as PIXI from 'pixi.js'
import { useEffect, useRef, useState } from 'react'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS, BUILDING_TYPES } from '@/domains/building/building.config'
import { ASSET_MANIFEST } from '@/components/colony/sprites/asset-manifest'

const TYPE_COLORS: Record<string, number> = {
  solar_panels: 0xFFD700, oxygen_generator: 0x00CCFF, water_extractor: 0x3366FF,
  mine: 0x996633, greenhouse: 0x33FF33, research_lab: 0xCC33FF,
}

function drawBuilding(b: BuildingRow, textures: Record<string, PIXI.Texture>) {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  const bConfig = BUILDING_TYPES[b.type], bw = bConfig?.width || 1, bh = bConfig?.height || 1
  const cont = new PIXI.Container(), pos = gridToScreen(b.x + bw / 2, b.y + bh / 2)
  cont.x = pos.x; cont.y = pos.y; cont.zIndex = (b.y + bh - 1) * 100 + (b.x + bw - 1)
  const tex = textures[b.type]
  if (tex) {
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5, 0.85)
    s.scale.set((TILE_WIDTH * bw * 1.5) / s.width); cont.addChild(s)
  } else {
    const c = TYPE_COLORS[b.type] || 0xcccccc, h = 30 * Math.max(bw, bh), w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2, g = new PIXI.Graphics()
    g.ellipse(0, 0, w2 * 0.8, h2 * 0.8).fill({ color: 0x000000, alpha: 0.2 })
    g.moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.6 })
    g.moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color: c, alpha: 0.8 })
    g.moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 1 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })
    cont.addChild(g)
  }
  const t = new PIXI.Text({ text: b.name.split(' ')[0], style: { fill: '#ffffff', fontSize: 10, fontWeight: 'bold', stroke: { color: '#000000', width: 2 } } })
  t.anchor.set(0.5); t.y = -45; cont.addChild(t); return cont
}

export default function ColonyCanvas({ buildings, onBuildingClick, placementMode, onConfirmPlacement }: { 
  buildings: BuildingRow[]; onBuildingClick: (b: BuildingRow) => void 
  placementMode: BuildingTypeKey | null; onConfirmPlacement: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null), appRef = useRef<PIXI.Application | null>(null)
  const worldRef = useRef<PIXI.Container | null>(null), buildingsRef = useRef<PIXI.Container | null>(null)
  const ghostRef = useRef<PIXI.Graphics | null>(null), texturesRef = useRef<Record<string, PIXI.Texture>>({})
  const isDragging = useRef(false), lastPos = useRef({ x: 0, y: 0 }), startDragPos = useRef({ x: 0, y: 0 })
  const ghostState = useRef({ valid: false, x: 0, y: 0 }), ghostListeners = useRef<{ move: (e: PIXI.FederatedPointerEvent) => void, up: (e: PIXI.FederatedPointerEvent) => void } | null>(null)
  const [initDone, setInitDone] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const app = new PIXI.Application()
    const init = async () => {
      await app.init({ width: containerRef.current?.clientWidth || 800, height: containerRef.current?.clientHeight || 600, background: '#121212', antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      if (!containerRef.current) return; containerRef.current.appendChild(app.canvas); appRef.current = app
      await Promise.all(Object.entries(ASSET_MANIFEST).map(async ([t, p]) => { try { texturesRef.current[t] = await PIXI.Assets.load(p) } catch {} }))
      const world = new PIXI.Container(); world.sortableChildren = true; worldRef.current = world
      world.x = app.screen.width / 2; world.y = app.screen.height / 2 - 320; app.stage.addChild(world)
      const { MAP_SIZE } = RENDER_LIMITS, grid = new PIXI.Graphics().setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.8 })
      for (let i = 0; i <= MAP_SIZE; i++) {
        const s1 = gridToScreen(i, 0), e1 = gridToScreen(i, MAP_SIZE), s2 = gridToScreen(0, i), e2 = gridToScreen(MAP_SIZE, i)
        grid.moveTo(s1.x, s1.y).lineTo(e1.x, e1.y).moveTo(s2.x, s2.y).lineTo(e2.x, e2.y)
      }
      grid.stroke(); grid.zIndex = -1; world.addChild(grid)
      const bl = new PIXI.Container(); bl.sortableChildren = true; buildingsRef.current = bl; world.addChild(bl)
      const g = new PIXI.Graphics(); g.zIndex = 9999; ghostRef.current = g; world.addChild(g)
      app.stage.eventMode = 'static'; app.stage.hitArea = app.screen
      app.stage.on('pointerdown', (e) => { isDragging.current = true; lastPos.current = { x: e.global.x, y: e.global.y }; startDragPos.current = { x: e.global.x, y: e.global.y } })
      app.stage.on('pointerup', () => { isDragging.current = false }); app.stage.on('pointerupoutside', () => { isDragging.current = false })
      app.stage.on('pointermove', (e) => {
        if (isDragging.current && worldRef.current) {
          worldRef.current.x += e.global.x - lastPos.current.x; worldRef.current.y += e.global.y - lastPos.current.y
          lastPos.current = { x: e.global.x, y: e.global.y }
        }
      })
      setInitDone(true)
    }
    init(); return () => { app.destroy(true) }
  }, [])

  useEffect(() => {
    const world = worldRef.current, app = appRef.current, bl = buildingsRef.current, ghost = ghostRef.current
    if (!initDone || !world || !app || !bl || !ghost) return
    bl.removeChildren().forEach(c => c.destroy()); buildings.forEach(b => {
      const cont = drawBuilding(b, texturesRef.current); cont.eventMode = 'static'; cont.cursor = 'pointer'
      cont.on('pointerup', (e) => { if (Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onBuildingClick(b) })
      bl.addChild(cont)
    })
    if (ghostListeners.current) { app.stage.off('pointermove', ghostListeners.current.move); app.stage.off('pointerup', ghostListeners.current.up) }
    ghost.clear(); ghost.visible = !!placementMode
    if (placementMode) {
      const updateGhost = (global: { x: number, y: number }) => {
        const lp = world.toLocal(global), sn = screenToGrid(lp.x, lp.y), bCfg = BUILDING_TYPES[placementMode]
        const bw = bCfg?.width || 1, bh = bCfg?.height || 1, { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
        let v = sn.x >= 0 && (sn.x + bw) <= MAP_SIZE && sn.y >= 0 && (sn.y + bh) <= MAP_SIZE
        if (v && buildings.some(b => {
          const c = BUILDING_TYPES[b.type], ew = c?.width || 1, eh = c?.height || 1
          return !(sn.x >= b.x + ew || sn.x + bw <= b.x || sn.y >= b.y + eh || sn.y + bh <= b.y)
        })) v = false
        ghostState.current = { valid: v, x: sn.x, y: sn.y }
        const pos = gridToScreen(sn.x + bw / 2, sn.y + bh / 2), c = v ? 0x00ff00 : 0xff0000, w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2, h = 30 * Math.max(bw, bh)
        ghost.x = pos.x; ghost.y = pos.y; ghost.clear().moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.3 })
          .moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color: c, alpha: 0.4 })
          .moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.5 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })
      }
      const onMove = (e: PIXI.FederatedPointerEvent) => updateGhost(e.global)
      const onUp = (e: PIXI.FederatedPointerEvent) => { if (ghostState.current.valid && Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onConfirmPlacement(ghostState.current.x, ghostState.current.y) }
      app.stage.on('pointermove', onMove); app.stage.on('pointerup', onUp); ghostListeners.current = { move: onMove, up: onUp }
      updateGhost({ x: app.screen.width / 2, y: app.screen.height / 2 })
    }
  }, [initDone, buildings, placementMode, onBuildingClick, onConfirmPlacement])

  return <div ref={containerRef} className="w-full h-full min-h-[500px] bg-[#111111] overflow-hidden cursor-move" />
}
