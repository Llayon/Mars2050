'use client'

import * as PIXI from 'pixi.js'
import { useEffect, useRef, useState } from 'react'
import { gridToScreen, screenToGrid } from '@/domains/building/building.isometric'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS, BUILDING_TYPES } from '@/domains/building/building.config'
import { ASSET_MANIFEST } from '@/components/colony/sprites/asset-manifest'
import { COLONY_GRID_SIZE, TERRAIN_CONFIG, TERRAIN_BUILDING_MODIFIERS } from '@/domains/colony/colony-terrain.config'
import type { TerrainGrid } from '@/domains/colony/colony-terrain.types'
import { validateBuildingPlacement } from '@/domains/building/building-placement'
import type { Colony } from '@/domains/colony/colony.types'
import { ADJACENCY_RULES } from '@/domains/building/building.adjacency'

const TYPE_COLORS: Record<string, number> = {
  solar_panels: 0xFFD700, oxygen_generator: 0x00CCFF, water_extractor: 0x3366FF,
  mine: 0x996633, greenhouse: 0x33FF33, research_lab: 0xCC33FF,
  habitat: 0xCCCCCC, habitat_mk2: 0xDDDDDD, habitat_mk3: 0xEEEEEE,
  community_hall: 0xFFB6C1, workshop: 0xCD853F, advanced_mine: 0x8B4513,
  geothermal_plant: 0xFF4500, vehicle_bay: 0x708090, biotech_lab: 0x32CD32,
  data_center: 0x00CED1, university: 0x9370DB, nanoforge: 0x4682B4,
  spaceport: 0x1E90FF, military_academy: 0x8B0000, hq: 0x4B0082, executive_dome: 0xFFDF00
}

function drawBuilding(b: BuildingRow, textures: Record<string, PIXI.Texture>) {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  const bConfig = BUILDING_TYPES[b.type], bw = bConfig?.width || 1, bh = bConfig?.height || 1
  const cont = new PIXI.Container(), pos = gridToScreen(b.x + bw / 2, b.y + bh / 2)
  cont.x = pos.x; cont.y = pos.y; cont.zIndex = (b.y + bh - 1) * 100 + (b.x + bw - 1)
  const tex = textures[b.type]
  if (tex) {
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5, 0.85)
    s.scale.set((TILE_WIDTH * bw) / s.width); cont.addChild(s)
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

export default function ColonyCanvas({ colony, buildings, onBuildingClick, placementMode, onConfirmPlacement }: { 
  colony: Colony | null; buildings: BuildingRow[]; onBuildingClick: (b: BuildingRow) => void 
  placementMode: BuildingTypeKey | null; onConfirmPlacement: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null), appRef = useRef<PIXI.Application | null>(null)
  const worldRef = useRef<PIXI.Container | null>(null), buildingsRef = useRef<PIXI.Container | null>(null), terrainRef = useRef<PIXI.Graphics | null>(null)
  const ghostRef = useRef<PIXI.Graphics | null>(null), texturesRef = useRef<Record<string, PIXI.Texture>>({})
  const ghostTextRef = useRef<PIXI.Text | null>(null)
  const isDragging = useRef(false), lastPos = useRef({ x: 0, y: 0 }), startDragPos = useRef({ x: 0, y: 0 })
  const ghostState = useRef({ valid: false, x: 0, y: 0 }), ghostListeners = useRef<{ move: (e: PIXI.FederatedPointerEvent) => void, up: (e: PIXI.FederatedPointerEvent) => void } | null>(null)
  const [initDone, setInitDone] = useState(false)

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
      await Promise.all(Object.entries(ASSET_MANIFEST).map(async ([t, p]) => { try { texturesRef.current[t] = await PIXI.Assets.load(p) } catch {} }))
      if (cancelled) return
      const world = new PIXI.Container(); world.sortableChildren = true; worldRef.current = world
      world.x = app.screen.width / 2; world.y = app.screen.height / 2 - 320; app.stage.addChild(world)
      const { MAP_SIZE } = RENDER_LIMITS, grid = new PIXI.Graphics().setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.8 })
      for (let i = 0; i <= COLONY_GRID_SIZE; i++) {
        const s1 = gridToScreen(i, 0), e1 = gridToScreen(i, COLONY_GRID_SIZE), s2 = gridToScreen(0, i), e2 = gridToScreen(COLONY_GRID_SIZE, i)
        grid.moveTo(s1.x, s1.y).lineTo(e1.x, e1.y).moveTo(s2.x, s2.y).lineTo(e2.x, e2.y)
      }
      grid.stroke(); grid.zIndex = -1; world.addChild(grid)
      const terrainLayer = new PIXI.Graphics(); terrainLayer.zIndex = -2; world.addChild(terrainLayer); terrainRef.current = terrainLayer
      const bl = new PIXI.Container(); bl.sortableChildren = true; buildingsRef.current = bl; world.addChild(bl)
      const g = new PIXI.Graphics(); g.zIndex = 9999; ghostRef.current = g; world.addChild(g)
      const gt = new PIXI.Text({ text: '', style: { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center', stroke: { color: 0x000000, width: 3 } } }); gt.zIndex = 10000; gt.anchor.set(0.5, 1); ghostTextRef.current = gt; world.addChild(gt)
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
    const world = worldRef.current, app = appRef.current, bl = buildingsRef.current, ghost = ghostRef.current, terrain = terrainRef.current
    if (!initDone || !world || !app || !bl || !ghost || !terrain) return

    terrain.clear()
    const tg = colony?.terrain_grid as TerrainGrid | undefined
    const radius = colony?.unlocked_radius || 5
    if (tg) {
      const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
      const w2 = TILE_WIDTH / 2, h2 = TILE_HEIGHT / 2
      tg.forEach(cell => {
        const config = TERRAIN_CONFIG[cell.t]
        const pos = gridToScreen(cell.x + 0.5, cell.y + 0.5)
        const maxDist = Math.max(Math.abs(cell.x - 19.5), Math.abs(cell.y - 19.5))
        const isUnlocked = maxDist <= radius - 0.5
        const color = config ? config.color : 0x8B4513
        const alpha = isUnlocked ? 1.0 : 0.2
        terrain.moveTo(pos.x, pos.y - h2).lineTo(pos.x + w2, pos.y).lineTo(pos.x, pos.y + h2).lineTo(pos.x - w2, pos.y).closePath().fill({ color, alpha })
        if (isUnlocked) terrain.stroke({ width: 1, color: 0x333333, alpha: 0.5 })
      })
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
  }, [initDone, buildings, placementMode, onBuildingClick, onConfirmPlacement])

  return <div ref={containerRef} className="w-full h-full min-h-[500px] bg-[#111111] overflow-hidden cursor-move" />
}
