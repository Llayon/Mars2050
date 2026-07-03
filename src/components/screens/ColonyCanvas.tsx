'use client'

import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { useEffect, useRef, useState } from 'react'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS, BUILDING_TYPES } from '@/domains/building/building.config'
import { COLONY_GRID_SIZE, TERRAIN_BUILDING_MODIFIERS } from '@/domains/colony/colony-terrain.config'
import type { TerrainGrid } from '@/domains/colony/colony-terrain.types'
import { validateBuildingPlacement } from '@/domains/building/building-placement'
import type { Colony } from '@/domains/colony/colony.types'
import { ADJACENCY_RULES } from '@/domains/building/building.adjacency'
import { drawBuilding, drawTerrain } from './colony-canvas-draw'
import { loadVisibleColonyTextures, preloadRemainingColonyTextures, scheduleColonyTexturePreload } from './colony-canvas-assets'

export default function ColonyCanvas({ colony, buildings, onBuildingClick, placementMode, onConfirmPlacement, isActive = true }: { 
  colony: Colony | null; buildings: BuildingRow[]; onBuildingClick: (b: BuildingRow) => void 
  placementMode: BuildingTypeKey | null; onConfirmPlacement: (x: number, y: number) => void;
  isActive?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null), appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const worldRef = useRef<PIXI.Container | null>(null), buildingsRef = useRef<PIXI.Container | null>(null), terrainRef = useRef<PIXI.Container | null>(null)
  const ghostRef = useRef<PIXI.Graphics | null>(null), texturesRef = useRef<Record<string, PIXI.Texture>>({})
  const ghostTextRef = useRef<PIXI.Text | null>(null)
  const startDragPos = useRef({ x: 0, y: 0 })
  const ghostState = useRef({ valid: false, x: 0, y: 0 }), ghostListeners = useRef<{ move: (e: PIXI.FederatedPointerEvent) => void, up: (e: PIXI.FederatedPointerEvent) => void } | null>(null)
  const [initDone, setInitDone] = useState(false)
  const [assetVersion, setAssetVersion] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const app = new PIXI.Application()
    let cancelled = false

    const init = async () => {
      await app.init({ width: containerRef.current?.clientWidth || 800, height: containerRef.current?.clientHeight || 600, background: '#121212', antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      // If component unmounted before init finished — destroy immediately and bail
      if (cancelled) { try { app.destroy(true) } catch {} return }
      if (!containerRef.current) return
      containerRef.current.appendChild(app.canvas); appRef.current = app
      const viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 3000,
        worldHeight: 3000,
        events: app.renderer.events
      })
      app.stage.addChild(viewport)
      viewportRef.current = viewport

      viewport
        .drag({ pressDrag: true })
        .pinch()
        .wheel()
        .decelerate()

      viewport.clampZoom({
        minScale: 0.4,
        maxScale: 2.0
      })

      viewport.clamp({
        left: -1500,
        right: 1500,
        top: -500,
        bottom: 1500,
        underflow: 'center'
      })

      viewport.moveCenter(0, 640)

      const world = new PIXI.Container()
      world.sortableChildren = true
      worldRef.current = world
      viewport.addChild(world)

      const { MAP_SIZE } = RENDER_LIMITS, grid = new PIXI.Graphics().setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.8 })
      for (let i = 0; i <= COLONY_GRID_SIZE; i++) {
        const s1 = gridToScreen(i, 0), e1 = gridToScreen(i, COLONY_GRID_SIZE), s2 = gridToScreen(0, i), e2 = gridToScreen(COLONY_GRID_SIZE, i)
        grid.moveTo(s1.x, s1.y).lineTo(e1.x, e1.y).moveTo(s2.x, s2.y).lineTo(e2.x, e2.y)
      }
      grid.stroke(); grid.zIndex = -1; world.addChild(grid)
      const terrainLayer = new PIXI.Container(); terrainLayer.zIndex = -2; world.addChild(terrainLayer); terrainRef.current = terrainLayer
      const bl = new PIXI.Container(); bl.sortableChildren = true; buildingsRef.current = bl; world.addChild(bl)
      const g = new PIXI.Graphics(); g.zIndex = 9999; ghostRef.current = g; world.addChild(g)
      const gt = new PIXI.Text({ text: '', style: { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center', stroke: { color: 0x000000, width: 3 } } }); gt.zIndex = 10000; gt.anchor.set(0.5, 1); ghostTextRef.current = gt; world.addChild(gt)
      
      app.stage.eventMode = 'static'; app.stage.hitArea = app.screen
      app.stage.on('pointerdown', (e) => { startDragPos.current = { x: e.global.x, y: e.global.y } })
      setInitDone(true)
    }

    init()
    return () => {
      cancelled = true
      // Only destroy if init already attached the app (appRef was set)
      if (appRef.current) {
        try { appRef.current.destroy(true) } catch {}
        appRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const app = appRef.current
    if (!app || !initDone) return

    const updatePlayState = () => {
      if (isActive && document.visibilityState === 'visible') {
        app.start()
      } else {
        app.stop()
      }
    }

    updatePlayState()

    document.addEventListener('visibilitychange', updatePlayState)
    return () => {
      document.removeEventListener('visibilitychange', updatePlayState)
    }
  }, [isActive, initDone])

  useEffect(() => {
    const container = containerRef.current
    const app = appRef.current
    const viewport = viewportRef.current
    if (!container || !app || !initDone) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        app.renderer.resize(width, height)
        if (viewport) {
          viewport.resize(width, height)
        }
      }
    })

    observer.observe(container)
    return () => {
      observer.disconnect()
    }
  }, [initDone])

  useEffect(() => {
    if (!initDone) return
    let cancelled = false
    const terrainGrid = colony?.terrain_grid as TerrainGrid | undefined
    void loadVisibleColonyTextures(texturesRef.current, terrainGrid, colony?.unlocked_radius || 5, buildings)
      .then(changed => { if (!cancelled && changed) setAssetVersion(v => v + 1) })
    return () => { cancelled = true }
  }, [initDone, colony?.terrain_grid, colony?.unlocked_radius, buildings])

  useEffect(() => {
    if (!initDone) return
    let cancelled = false
    const cancelPreload = scheduleColonyTexturePreload(() => {
      void preloadRemainingColonyTextures(texturesRef.current)
        .then(changed => { if (!cancelled && changed) setAssetVersion(v => v + 1) })
    })
    return () => { cancelled = true; cancelPreload() }
  }, [initDone])

  useEffect(() => {
    const world = worldRef.current, app = appRef.current, bl = buildingsRef.current, ghost = ghostRef.current, terrain = terrainRef.current
    if (!initDone || !world || !app || !bl || !ghost || !terrain) return

    const tg = colony?.terrain_grid as TerrainGrid | undefined
    const radius = colony?.unlocked_radius || 5
    if (tg) {
      drawTerrain(terrain, tg, radius, texturesRef.current)
    }
    bl.removeChildren().forEach(c => c.destroy()); buildings.forEach(b => {
      const cont = drawBuilding(b, texturesRef.current); cont.eventMode = 'static'; cont.cursor = 'pointer'
      cont.on('pointerup', (e) => { if (Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onBuildingClick(b) })
      bl.addChild(cont)
    })
    if (ghostListeners.current) { app.stage.off('pointermove', ghostListeners.current.move); app.stage.off('pointerup', ghostListeners.current.up) }
    ghost.clear(); ghost.visible = !!placementMode
    if (ghostTextRef.current) ghostTextRef.current.visible = !!placementMode
    if (placementMode) {
      const updateGhost = (global: { x: number, y: number }) => {
        const lp = world.toLocal(global), sn = screenToGrid(lp.x, lp.y), bCfg = BUILDING_TYPES[placementMode]
        const bw = bCfg?.width || 1, bh = bCfg?.height || 1, { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
        
        const mappedBuildings = buildings.map(b => {
          const c = BUILDING_TYPES[b.type]
          return { x: b.x, y: b.y, width: c?.width || 1, height: c?.height || 1 }
        })
        
        const validation = validateBuildingPlacement({
          x: sn.x, y: sn.y, width: bw, height: bh,
          unlockedRadius: colony?.unlocked_radius || 5,
          terrainGrid: (colony?.terrain_grid as TerrainGrid) || [],
          occupiedCells: mappedBuildings
        })
        
        const v = validation.valid
        ghostState.current = { valid: v, x: sn.x, y: sn.y }
        const pos = gridToScreen(sn.x + bw / 2, sn.y + bh / 2), c = v ? 0x00ff00 : 0xff0000, w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2, h = 30 * Math.max(bw, bh)
        ghost.x = pos.x; ghost.y = pos.y; ghost.clear().moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.3 })
          .moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color: c, alpha: 0.4 })
          .moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.5 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })

        if (ghostTextRef.current) {
          ghostTextRef.current.x = pos.x
          ghostTextRef.current.y = pos.y - h - 10
          let text = ''
          if (!v) {
            text = `⚠️ ${validation.error || 'Blocked'}`
          } else {
            const cell = (colony?.terrain_grid as TerrainGrid)?.find(c => c.x === sn.x && c.y === sn.y)
            if (cell) {
              const tm = TERRAIN_BUILDING_MODIFIERS[cell.t]
              if (tm?.bonuses && tm.bonuses[placementMode]) {
                text += `+${tm.bonuses[placementMode] * 100}% terrain (${cell.t})\n`
              }
              if (tm?.penalties && tm.penalties[placementMode]) {
                text += `${tm.penalties[placementMode] * 100}% terrain (${cell.t})\n`
              }
            }
            let adjMod = 0
            const neighbors = buildings.filter(b => b.is_active && Math.abs(b.x - sn.x) <= 1 && Math.abs(b.y - sn.y) <= 1)
            for (const n of neighbors) {
              const rule = ADJACENCY_RULES.find(r => r.source === placementMode && r.neighbor === n.type)
              if (rule) adjMod += rule.productionMult
            }
            if (adjMod !== 0) {
              text += `${adjMod > 0 ? '+' : ''}${Math.round(adjMod * 100)}% adjacency\n`
            }
          }
          ghostTextRef.current.text = text.trim()
        }
      }
      const onMove = (e: PIXI.FederatedPointerEvent) => updateGhost(e.global)
      const onUp = (e: PIXI.FederatedPointerEvent) => { if (ghostState.current.valid && Math.abs(e.global.x - startDragPos.current.x) < 5 && Math.abs(e.global.y - startDragPos.current.y) < 5) onConfirmPlacement(ghostState.current.x, ghostState.current.y) }
      app.stage.on('pointermove', onMove); app.stage.on('pointerup', onUp); ghostListeners.current = { move: onMove, up: onUp }
      updateGhost({ x: app.screen.width / 2, y: app.screen.height / 2 })
    }
  }, [initDone, assetVersion, colony, buildings, placementMode, onBuildingClick, onConfirmPlacement])

  return <div ref={containerRef} data-testid="colony-canvas-host" className="w-full h-full min-h-[500px] bg-[#111111] overflow-hidden cursor-move" />
}
