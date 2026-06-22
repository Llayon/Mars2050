import { Application, Graphics, Text, Container, Assets, Sprite, Texture } from 'pixi.js'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { FIELD_WIDTH, FIELD_HEIGHT, getDir, SPRITE_PATHS, SPRITE_DIRS, getSizeRadius } from '@/domains/combat/combat.utils'
import type { BattleTick, UnitRow, SimUnit, UnitTypeKey, Obstacle } from '@/domains/combat/combat.types'

export type BattleReplayEngineProps = {
  container: HTMLDivElement
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  initialState?: SimUnit[]
  logs: BattleTick[]
  obstacles?: Obstacle[]
}

export async function startBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, attackerUnits, defenderUnits, initialState, logs, obstacles } = props
  const isDestroyed = false
  let cleanupEvents: (() => void) | null = null

  const app = new Application()
  const TILE_SIZE = 40, BOARD_W = FIELD_WIDTH, BOARD_H = FIELD_HEIGHT
  await app.init({ width: BOARD_W, height: BOARD_H, backgroundColor: 0x1a1a2e, resolution: window.devicePixelRatio || 1, autoDensity: true })
  
  if (isDestroyed) return { app, cleanupEvents }
  
  container.appendChild(app.canvas)
  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  app.canvas.style.objectFit = 'contain'
  
  try {
    const toLoad = []
    for (const t in SPRITE_PATHS) {
      for (const d of SPRITE_DIRS) {
        toLoad.push(`${SPRITE_PATHS[t]}/${d}.png`)
      }
    }
    await Assets.load(toLoad)
  } catch(e) { console.error('Failed to load textures', e) }
  
  const world = new Container()
  world.pivot.set(BOARD_W / 2, BOARD_H / 2)
  world.x = BOARD_W / 2
  world.y = BOARD_H / 2
  world.scale.set(1.0)
  app.stage.addChild(world)
  const gridContainer = new Container()
  world.addChild(gridContainer)
  gridContainer.addChild(
    new Graphics().rect(0, 0, BOARD_W, BOARD_H / 2).fill({ color: 0xef4444, alpha: 0.05 }),
    new Graphics().rect(0, BOARD_H / 2, BOARD_W, BOARD_H / 2).fill({ color: 0x3b82f6, alpha: 0.05 })
  )

  obstacles?.forEach(o => gridContainer.addChild(
    new Graphics().circle(o.x, o.y, o.radius).fill({ color: 0x333333 }).stroke({ width: 2, color: 0x555555 })
  ))

  type SpriteState = { 
    c: Container, g?: Graphics, s?: Sprite, hpBar: Graphics, 
    hp: number, maxHp: number, prog: number, 
    sX: number, sY: number, tX: number, tY: number, 
    type: string, team: 'attacker'|'defender', basePath?: string, baseScale?: number
  }
  const sprites: Record<string, SpriteState> = {}


  const layer = new Container(), fxLayer = new Container()
  layer.sortableChildren = true
  world.addChild(layer, fxLayer)

  const updateHp = (s: SpriteState) => {
    s.hpBar.clear()
    if (s.hp <= 0) return
    const r = Math.max(0, s.hp / s.maxHp)
    s.hpBar.rect(-10, 0, 20, 3).fill({ color: 0x555555 }).rect(-10, 0, 20 * r, 3).fill({ color: r > 0.5 ? 0x4ade80 : 0xef4444 })
  }

  const createU = (u: SimUnit | UnitRow, t: 'attacker'|'defender', isSimUnit: boolean) => {
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

    if (SPRITE_PATHS[utype]) {
      basePath = SPRITE_PATHS[utype]
      const tex = Texture.from(`${basePath}/${t === 'attacker' ? 'north' : 'south'}.png`)
      s = new Sprite(tex)
      s.anchor.set(0.5, 0.8)
      const baseScale = (radius * 2.5) / 128
      s.scale.set(baseScale)
      c.addChild(s)
    } else {
      g = new Graphics()
      const col = t === 'attacker' ? 0x3b82f6 : 0xef4444
      g.circle(0, 0, radius).fill({ color: col })
      c.addChild(g)
      const txt = new Text({ text: utype[0].toUpperCase(), style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' } })
      txt.anchor.set(0.5); c.addChild(txt)
    }

    if (utype === 'drone') {
      const shadow = new Graphics().ellipse(0, 0, 10, 5).fill({ color: 0x000000, alpha: 0.5 })
      c.addChild(shadow)
    }
    
    const hpBar = new Graphics(); hpBar.y = utype === 'drone' ? -35 : -5
    c.addChild(hpBar)
    if (!u.id) return
    const maxHp = UNIT_TYPES[utype as UnitTypeKey]?.baseStats.hp || ('hp_current' in u ? u.hp_current : 1)
    const baseScale = s ? s.scale.x : 1
    sprites[u.id] = { c, g, s, hpBar, hp: isSimUnit ? (u as SimUnit).hp : ('hp_current' in u ? u.hp_current : 1), maxHp, prog: 1, sX: c.x, sY: c.y, tX: c.x, tY: c.y, type: utype, team: t, basePath, baseScale }
    updateHp(sprites[u.id])
  }

  if (initialState) {
    initialState.forEach(u => createU(u, u.team, true))
  } else {
    attackerUnits.forEach(u => createU(u, 'attacker', false)); defenderUnits.forEach(u => createU(u, 'defender', false))
  }

  let tick = 0, time = 0
  const DUR = 150
  type FX = { c: Container, life: number }
  type Proj = { g: Graphics, sX: number, sY: number, tX: number, tY: number, p: number, col: number }
  const fts: FX[] = [], projs: Proj[] = []
  const spawnTxt = (txt: string, x: number, y: number, col: number) => {
    const t = new Text({ text: txt, style: { fill: col, fontSize: 18, fontWeight: 'bold', dropShadow: { alpha: 0.5 } } })
    t.anchor.set(0.5); t.position.set(x, y - 20)
    fxLayer.addChild(t); fts.push({ c: t, life: 1 })
  }
  const spawnProj = (x1: number, y1: number, x2: number, y2: number, col: number) => {
    const p = new Graphics().circle(0, 0, 4).fill({ color: col }); p.position.set(x1, y1)
    fxLayer.addChild(p); projs.push({ g: p, sX: x1, sY: y1, tX: x2, tY: y2, p: 0, col })
  }

  app.ticker.add(({ deltaMS: dt }) => {
    time += dt
    
    while (time >= DUR && tick < logs.length) {
      time -= DUR
      
      Object.values(sprites).forEach(s => {
        s.sX = s.tX; s.sY = s.tY;
      })

      logs[tick].actions.forEach(a => {
        const s = sprites[a.unitId]
        if (!s) return
        if (a.type === 'move') {
          s.sX = a.fromX!; s.sY = a.fromY!
          s.tX = a.toX!; s.tY = a.toY!
          if (s.s && s.basePath) {
            if (a.facingAngle !== undefined) {
               const dx = Math.cos(a.facingAngle);
               const dy = Math.sin(a.facingAngle);
               s.s.texture = Texture.from(`${s.basePath}/${getDir(dx, dy)}.png`)
            } else {
               s.s.texture = Texture.from(`${s.basePath}/${getDir(s.tX - s.sX, s.tY - s.sY)}.png`)
            }
          }
        } else if (a.type === 'attack' || a.type === 'heal') {
          const tg = sprites[a.targetId!]
          if (tg) {
            const isH = a.type === 'heal', pCol = isH ? 0x4ade80 : 0xffaa00
            spawnProj(s.c.x, s.c.y, tg.c.x, tg.c.y, pCol)
            if (s.s && s.basePath) {
              s.s.texture = Texture.from(`${s.basePath}/${getDir(tg.c.x - s.c.x, tg.c.y - s.c.y)}.png`)
            }
            
            tg.hp -= isH ? -a.damage! : a.damage!
            updateHp(tg)
            spawnTxt(isH ? `+${a.damage}` : `-${a.damage}`, tg.c.x, tg.c.y, pCol)
            
            if (s.s && s.baseScale !== undefined) {
               s.s.scale.set(s.baseScale * 1.2)
            }
          }
        } else if (a.type === 'die') {
          s.c.alpha = 0.3; s.hpBar.alpha = 0
          if (s.s) s.s.tint = 0x555555
        } else if (a.type === 'spawn') {
          createU({ id: a.targetId!, unit_type: a.spawnType! as UnitTypeKey, grid_x: String(a.toX!), grid_y: String(a.toY!), hp_current: a.spawnMaxHp!, colony_id: '1', tier: 1, upgrade_path: [] }, a.spawnTeam as 'attacker'|'defender', false)
          const newS = sprites[a.targetId!]
          if (newS) { newS.sX = a.toX!; newS.sY = a.toY!; newS.tX = a.toX!; newS.tY = a.toY!; }
        }
      })
      tick++
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const easeOutQuad = (t: number) => t * (2 - t)
    const prog = easeOutQuad(Math.min(1, time / DUR))
    Object.values(sprites).forEach(s => {
      s.c.x = lerp(s.sX, s.tX, prog); s.c.y = lerp(s.sY, s.tY, prog)
      layer.children.sort((a, b) => a.y - b.y)
      if (s.s && s.baseScale !== undefined) {
         s.s.scale.x = lerp(s.s.scale.x, s.baseScale, 0.1)
         s.s.scale.y = lerp(s.s.scale.y, s.baseScale, 0.1)
      }
    })

    for (let i = fts.length - 1; i >= 0; i--) {
      const f = fts[i]
      f.life -= dt * 0.002; f.c.y -= dt * 0.02; f.c.alpha = f.life
      if (f.life <= 0) { f.c.destroy(); fts.splice(i, 1) }
    }
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]
      p.p += dt * 0.005; p.g.x = lerp(p.sX, p.tX, p.p); p.g.y = lerp(p.sY, p.tY, p.p)
      if (p.p >= 1) { p.g.destroy(); projs.splice(i, 1) }
    }
  })

  let isDragging = false, lastPos = { x: 0, y: 0 }
  const onPointerDown = (e: PointerEvent) => { isDragging = true; lastPos = { x: e.clientX, y: e.clientY } }
  const onPointerUp = () => { isDragging = false }
  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.x, dy = e.clientY - lastPos.y
    world.x += dx; world.y += dy
    lastPos = { x: e.clientX, y: e.clientY }
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const zoom = e.deltaY < 0 ? 1.1 : 0.9
    world.scale.x = Math.max(0.5, Math.min(5, world.scale.x * zoom))
    world.scale.y = Math.max(0.5, Math.min(5, world.scale.y * zoom))
  }

  app.canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointermove', onPointerMove)
  app.canvas.addEventListener('wheel', onWheel)

  cleanupEvents = () => {
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointermove', onPointerMove)
  }

  return { app, cleanupEvents }
}
