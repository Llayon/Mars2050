import type { Graphics } from 'pixi.js'
import type { SimUnit, UnitTypeKey } from '@/domains/combat/combat.types'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { getSizeRadius } from '@/domains/combat/combat.utils'

interface SpriteState {
  hp: number
  c: { x: number, y: number }
  sX: number
  sY: number
  tX: number
  tY: number
  team: 'attacker' | 'defender'
  type: string
}

export function drawOverlays(
  overlayGfx: Graphics,
  overlays: { radius: boolean; velocity: boolean; targets: boolean },
  sprites: Record<string, SpriteState>,
  projs: { sX: number; sY: number; tX: number; tY: number }[]
) {
  overlayGfx.clear()
  if (!overlays.radius && !overlays.velocity && !overlays.targets) return

  Object.values(sprites).forEach(s => {
    if (s.hp <= 0) return
    const radius = getSizeRadius(UNIT_TYPES[s.type as UnitTypeKey]?.baseStats.size || 'M')
    
    if (overlays.radius) {
      overlayGfx.circle(s.c.x, s.c.y, radius).stroke({ width: 1, color: s.team === 'attacker' ? 0x3b82f6 : 0xef4444, alpha: 0.5 })
    }
    if (overlays.velocity && (s.tX !== s.sX || s.tY !== s.sY)) {
      const dx = s.tX - s.sX
      const dy = s.tY - s.sY
      const len = Math.hypot(dx, dy)
      if (len > 0) {
        overlayGfx.moveTo(s.c.x, s.c.y).lineTo(s.c.x + (dx/len)*30, s.c.y + (dy/len)*30).stroke({ width: 2, color: 0xffff00, alpha: 0.8 })
      }
    }
  })
  if (overlays.targets) {
    projs.forEach(p => {
      overlayGfx.moveTo(p.sX, p.sY).lineTo(p.tX, p.tY).stroke({ width: 1, color: 0xff0000, alpha: 0.4 })
    })
  }
}
