import { Container, Graphics, Sprite, Texture, Text } from 'pixi.js'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { getSizeRadius, SPRITE_ATLASES, SPRITE_PATHS } from '@/domains/combat/combat.utils'
import type { SimUnit, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

export type SpriteState = { 
  c: Container, g?: Graphics, s?: Sprite, hpBar: Graphics, empGfx?: Graphics,
  hp: number, maxHp: number, prog: number, sX: number, sY: number, tX: number, tY: number, 
  type: string, team: 'attacker'|'defender', basePath?: string, baseScale?: number, isAtlas?: boolean, act?: string, dir?: string
}

export function updateHp(s: SpriteState) {
  s.hpBar.clear()
  if (s.hp <= 0) return
  const r = Math.max(0, s.hp / s.maxHp)
  s.hpBar.rect(-10, 0, 20, 3).fill({ color: 0x555555 }).rect(-10, 0, 20 * r, 3).fill({ color: r > 0.5 ? 0x4ade80 : 0xef4444 })
}

export function createU(
  u: SimUnit | UnitRow, 
  t: 'attacker'|'defender', 
  isSimUnit: boolean,
  layer: Container,
  sprites: Record<string, SpriteState>
) {
  const c = new Container()
  c.x = isSimUnit ? (u as SimUnit).x : Number((u as UnitRow).grid_x||0)
  c.y = isSimUnit ? (u as SimUnit).y : Number((u as UnitRow).grid_y||0)
  layer.addChild(c)
  
  let g: Graphics | undefined
  let s: Sprite | undefined
  let basePath: string | undefined
  const utype = isSimUnit ? (u as SimUnit).type : (u as UnitRow).unit_type
  const config = UNIT_TYPES[utype as UnitTypeKey];
  const uSize = config?.baseStats.size || 'M';
  const radius = getSizeRadius(uSize);
  const tDir = t === 'attacker' ? 'north' : 'south';
  const scaleMultiplier = utype === 'flamethrower' ? 0.75 : 1;

  if (SPRITE_ATLASES[utype]) {
    s = new Sprite(Texture.from(`${utype}_idle_${tDir}_00`))
    s.anchor.set(0.5, 0.8); s.scale.set(((radius * 8) / 128) * scaleMultiplier); c.addChild(s)
  } else if (SPRITE_PATHS[utype]) {
    basePath = SPRITE_PATHS[utype]
    s = new Sprite(Texture.from(`${basePath}/${tDir}.png`))
    s.anchor.set(0.5, 0.8); s.scale.set(((radius * 8) / 128) * scaleMultiplier); c.addChild(s)
  } else {
    g = new Graphics(); g.circle(0, 0, radius).fill({ color: t === 'attacker' ? 0x3b82f6 : 0xef4444 }); c.addChild(g)
    const txt = new Text({ text: utype[0].toUpperCase(), style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' } })
    txt.anchor.set(0.5); c.addChild(txt)
  }

  if (utype === 'drone') c.addChild(new Graphics().ellipse(0, 0, 10, 5).fill({ color: 0x000000, alpha: 0.5 }))
  
  const hpBar = new Graphics(); hpBar.y = -(radius * 2.5) - 5
  c.addChild(hpBar)
  if (!u.id) return
  const maxHp = UNIT_TYPES[utype as UnitTypeKey]?.baseStats.hp || ('hp_current' in u ? u.hp_current : 1)
  const baseScale = s ? s.scale.x : 1
  sprites[u.id] = { c, g, s, hpBar, hp: isSimUnit ? (u as SimUnit).hp : ('hp_current' in u ? u.hp_current : 1), maxHp, prog: 1, sX: c.x, sY: c.y, tX: c.x, tY: c.y, type: utype, team: t, basePath, baseScale, isAtlas: !!SPRITE_ATLASES[utype], act: 'idle', dir: t === 'attacker' ? 'north' : 'south' }
  updateHp(sprites[u.id])
}
