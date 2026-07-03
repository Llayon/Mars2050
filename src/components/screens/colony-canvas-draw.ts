import * as PIXI from 'pixi.js'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import { RENDER_LIMITS, BUILDING_TYPES, BUILDING_TYPE_COLORS } from '@/domains/building/building.config'
import { gridToScreen } from '@/domains/building/building.isometric'
import type { TerrainGrid } from '@/domains/colony/colony-terrain.types'

/**
 * Draws an isometric building container with its sprite or fallback graphics and label.
 * @param b - The building row data
 * @param textures - Map of loaded textures
 * @returns PIXI.Container containing the drawn building
 */
export function drawBuilding(b: BuildingRow, textures: Record<string, PIXI.Texture>): PIXI.Container {
  const { TILE_WIDTH, TILE_HEIGHT } = RENDER_LIMITS
  const bConfig = BUILDING_TYPES[b.type], bw = bConfig?.width || 1, bh = bConfig?.height || 1
  const cont = new PIXI.Container(), pos = gridToScreen(b.x + bw / 2, b.y + bh / 2)
  cont.x = pos.x; cont.y = pos.y; cont.zIndex = (b.y + bh - 1) * 100 + (b.x + bw - 1)
  const tex = textures[b.type]
  if (tex) {
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5, 0.85)
    s.scale.set((TILE_WIDTH * bw) / s.width); cont.addChild(s)
  } else {
    const c = BUILDING_TYPE_COLORS[b.type as BuildingTypeKey] || 0xcccccc, h = 30 * Math.max(bw, bh), w2 = (TILE_WIDTH * bw) / 2, h2 = (TILE_HEIGHT * bh) / 2, g = new PIXI.Graphics()
    g.ellipse(0, 0, w2 * 0.8, h2 * 0.8).fill({ color: 0x000000, alpha: 0.2 })
    g.moveTo(-w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 0.6 })
    g.moveTo(w2, 0).lineTo(0, h2).lineTo(0, h2 - h).lineTo(w2, -h).closePath().fill({ color: c, alpha: 0.8 })
    g.moveTo(0, h2 - h).lineTo(w2, -h).lineTo(0, -h2 - h).lineTo(-w2, -h).closePath().fill({ color: c, alpha: 1 }).stroke({ width: 1, color: 0xffffff, alpha: 0.5 })
    cont.addChild(g)
  }
  const t = new PIXI.Text({ text: b.name.split(' ')[0], style: { fill: '#ffffff', fontSize: 10, fontWeight: 'bold', stroke: { color: '#000000', width: 2 } } })
  t.anchor.set(0.5); t.y = -45; cont.addChild(t); return cont
}

/**
 * Renders or updates the colony terrain grid and applies the global dirt mask overlay.
 * @param terrain - Container holding all terrain tiles
 * @param tg - Terrain grid data array
 * @param radius - Unlocked colony radius
 * @param textures - Map of loaded textures
 */
export function drawTerrain(
  terrain: PIXI.Container,
  tg: TerrainGrid,
  radius: number,
  textures: Record<string, PIXI.Texture>
) {
  if (tg.length === 0) return

  const created = terrain.children.length > 0
  tg.forEach((cell, i) => {
    const pos = gridToScreen(cell.x + 0.5, cell.y + 0.5)
    const maxDist = Math.max(Math.abs(cell.x - 19.5), Math.abs(cell.y - 19.5))
    const isUnlocked = maxDist <= radius - 0.5
    const alpha = isUnlocked ? 1.0 : 0.2

    let s: PIXI.Sprite
    if (!created) {
      s = new PIXI.Sprite(textures[`terrain_${cell.t}`] || textures['terrain_regolith'])
      s.anchor.set(0.5, cell.t === 'blocked_rock' ? 0.75 : 0.5)
      s.x = pos.x
      s.y = pos.y
      terrain.addChild(s)
    } else {
      s = terrain.children[i] as PIXI.Sprite
      const nextTexture = textures[`terrain_${cell.t}`] || textures['terrain_regolith']
      if (nextTexture && s.texture !== nextTexture) s.texture = nextTexture
      s.anchor.set(0.5, cell.t === 'blocked_rock' ? 0.75 : 0.5)
    }
    s.alpha = alpha
  })

  // Add dirt overlay
  const overlayTex = textures['dirt_mask']
  if (overlayTex) {
    if (!created) {
      const overlay = new PIXI.Sprite(overlayTex)
      overlay.anchor.set(0.5, 0.5)
      overlay.x = 0
      overlay.y = 640
      overlay.width = 2560
      overlay.height = 1280
      overlay.alpha = 0.35
      overlay.blendMode = 'multiply'
      terrain.addChild(overlay)
    }
  }
}
