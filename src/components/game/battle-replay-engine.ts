import { Application, Graphics, Text, Container, Assets, Sprite, Texture } from 'pixi.js'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { FIELD_WIDTH, FIELD_HEIGHT, getDir, SPRITE_PATHS, SPRITE_ATLASES, SPRITE_DIRS, getSizeRadius } from '@/domains/combat/combat.utils'
import type { BattleTick, UnitRow, SimUnit, UnitTypeKey, Obstacle } from '@/domains/combat/combat.types'
import { setupCameraControls } from './battle-replay-camera'
import { processVisualEffects, lerp } from './battle-replay-utils'

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
    const toLoad = ['/sprites/crater.svg']
    for (const t in SPRITE_PATHS) for (const d of SPRITE_DIRS) toLoad.push(`${SPRITE_PATHS[t]}/${d}.png`)
    for (const t in SPRITE_ATLASES) toLoad.push(SPRITE_ATLASES[t])
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

  obstacles?.forEach(o => {
    try {
      const tex = Texture.from('/sprites/crater.svg')
      const s = new Sprite(tex)
      s.anchor.set(0.5)
      s.position.set(o.x, o.y)
      s.width = o.radius * 2
      s.height = o.radius * 2
      gridContainer.addChild(s)
    } catch(e) {
      gridContainer.addChild(
        new Graphics().circle(o.x, o.y, o.radius).fill({ color: 0x5c4033, alpha: 0.8 }).stroke({ width: 3, color: 0x3e2723, alpha: 1 })
      )
    }
  })

  type SpriteState = { 
    c: Container, g?: Graphics, s?: Sprite, hpBar: Graphics, empGfx?: Graphics,
    hp: number, maxHp: number, prog: number, sX: number, sY: number, tX: number, tY: number, 
    type: string, team: 'attacker'|'defender', basePath?: string, baseScale?: number, isAtlas?: boolean, act?: string, dir?: string
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
    const tDir = t === 'attacker' ? 'north' : 'south';

    if (SPRITE_ATLASES[utype]) {
      s = new Sprite(Texture.from(`${utype}_idle_${tDir}_00`))
      s.anchor.set(0.5, 0.8); s.scale.set((radius * 12) / 128); c.addChild(s)
    } else if (SPRITE_PATHS[utype]) {
      basePath = SPRITE_PATHS[utype]
      s = new Sprite(Texture.from(`${basePath}/${tDir}.png`))
      s.anchor.set(0.5, 0.8); s.scale.set((radius * 12) / 128); c.addChild(s)
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
  if (initialState) {
    initialState.forEach(u => createU(u, u.team, true))
  } else {
    attackerUnits.forEach(u => createU(u, 'attacker', false)); defenderUnits.forEach(u => createU(u, 'defender', false))
  }

  let tick = 0, time = 0
  const DUR = 150
  type FX = { c: Container, life: number }
  type Proj = { g: Graphics, sX: number, sY: number, tX: number, tY: number, p: number, col: number }
  type HazardFX = { g: Graphics, life: number }
  const fts: FX[] = [], projs: Proj[] = [], hazardFxs: HazardFX[] = []
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
        s.sX = s.tX; s.sY = s.tY; s.act = 'idle'
      })

      logs[tick].actions.forEach(a => {
        const s = sprites[a.unitId]
        if (!s) return
        if (a.type === 'move') {
          s.sX = a.fromX!; s.sY = a.fromY!
          s.tX = a.toX!; s.tY = a.toY!
          if (s.s) {
            s.dir = a.facingAngle !== undefined ? getDir(Math.cos(a.facingAngle), Math.sin(a.facingAngle)) : getDir(s.tX - s.sX, s.tY - s.sY);
            s.act = 'walk'
          }
        } else if (a.type === 'attack' || a.type === 'heal') {
          const tg = sprites[a.targetId!]
          if (tg) {
            const isH = a.type === 'heal', pCol = isH ? 0x4ade80 : (a.isShieldHit ? 0x3b82f6 : 0xffaa00)
            spawnProj(s.c.x, s.c.y, tg.c.x, tg.c.y, pCol)
            if (s.s) {
              s.dir = getDir(tg.c.x - s.c.x, tg.c.y - s.c.y);
              s.act = 'shoot'
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
        } else if (a.type === 'hazard_spawn') {
          const hGfx = new Graphics().circle(0, 0, a.radius || 60).fill({ color: 0xff4400, alpha: 0.3 })
          hGfx.position.set(a.toX!, a.toY!)
          gridContainer.addChild(hGfx)
          hazardFxs.push({ g: hGfx, life: 1.0 })
        } else if (a.type === 'status_apply') {
          if (a.statusType === 'emp') {
            if (!s.empGfx) {
               s.empGfx = new Graphics().circle(0, -10, 20).stroke({ width: 2, color: 0x00ffff, alpha: 0.8 })
               s.c.addChild(s.empGfx)
            }
            s.empGfx.visible = true
          }
        } else if (a.type === 'status_expire') {
          if (a.statusType === 'emp' && s.empGfx) {
             s.empGfx.visible = false
          }
        }
      })
      tick++
    }


    const easeOutQuad = (t: number) => t * (2 - t)
    const prog = easeOutQuad(Math.min(1, time / DUR))
    Object.values(sprites).forEach(s => {
      s.c.x = lerp(s.sX, s.tX, prog); s.c.y = lerp(s.sY, s.tY, prog)
      layer.children.sort((a, b) => a.y - b.y)
      if (s.s && s.isAtlas && s.act && s.dir) {
         const f = Math.min(6, Math.floor((time / DUR) * 7));
         s.s.texture = Texture.from(`${s.type}_${s.act}_${s.dir}_00${s.act === 'idle' ? '' : f}`)
      } else if (s.s && s.basePath && s.dir) {
         s.s.texture = Texture.from(`${s.basePath}/${s.dir}.png`)
      }
      if (s.s && s.baseScale !== undefined) {
         s.s.scale.x = lerp(s.s.scale.x, s.baseScale, 0.1)
         s.s.scale.y = lerp(s.s.scale.y, s.baseScale, 0.1)
      }
    })

    processVisualEffects(fts, projs, hazardFxs, dt)
  })

  cleanupEvents = setupCameraControls(app, world)

  return { app, cleanupEvents }
}
