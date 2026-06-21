'use client'
import { useEffect, useRef, memo } from 'react'
import { Application, Graphics, Text, Container, Assets, Sprite, Texture } from 'pixi.js'
import { GRID_WIDTH, GRID_HEIGHT, UNIT_TYPES } from '@/domains/combat/combat.config'
import type { BattleTick, UnitRow, UnitTypeKey } from '@/domains/combat/combat.types'

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, logs, onClose }: { attackerUnits: UnitRow[], defenderUnits: UnitRow[], logs: BattleTick[], onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let app: Application, isDestroyed = false
    async function initPixi() {
      app = new Application()
      const TILE_SIZE = 40, BOARD_W = GRID_WIDTH * TILE_SIZE, BOARD_H = GRID_HEIGHT * TILE_SIZE
      await app.init({ width: BOARD_W, height: BOARD_H, backgroundColor: 0x1a1a2e, resolution: window.devicePixelRatio || 1, autoDensity: true })
      if (isDestroyed) return
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas)
        app.canvas.style.width = '100%'
        app.canvas.style.height = '100%'
        app.canvas.style.objectFit = 'contain'
      }
      
      try {
        const spritePaths: Record<string, string> = {
          'marine': '/sprites/marine/rotations',
          'rocketeer': '/sprites/rocketeer',
          'exosuit': '/sprites/exosuit',
          'sniper': '/sprites/sniper',
          'medic': '/sprites/medic',
          'turret': '/sprites/turret'
        }
        const dirs = ['north', 'south', 'east', 'west', 'north-east', 'north-west', 'south-east', 'south-west']
        const toLoad = []
        for (const t in spritePaths) {
          for (const d of dirs) {
            toLoad.push(`${spritePaths[t]}/${d}.png`)
          }
        }
        await Assets.load(toLoad)
      } catch(e) { console.error('Failed to load textures', e) }
      
      const gridContainer = new Container()
      app.stage.addChild(gridContainer)

      const defZone = new Graphics().rect(0, 0, BOARD_W, BOARD_H / 2).fill({ color: 0xef4444, alpha: 0.05 })
      const atkZone = new Graphics().rect(0, BOARD_H / 2, BOARD_W, BOARD_H / 2).fill({ color: 0x3b82f6, alpha: 0.05 })
      gridContainer.addChild(defZone, atkZone)

      // Grid lines hidden during battle replay for a more natural tactical look

      type SpriteState = { 
        c: Container, 
        g?: Graphics, 
        s?: Sprite,
        hpBar: Graphics, 
        hp: number, 
        maxHp: number, 
        prog: number, 
        sX: number, 
        sY: number, 
        tX: number, 
        tY: number, 
        type: string, 
        team: string,
        basePath?: string
      }
      const sprites: Record<string, SpriteState> = {}

      const getDir = (dx: number, dy: number) => {
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return 'south'
        const a = Math.atan2(dy, dx) * 180 / Math.PI
        if (a >= -22.5 && a < 22.5) return 'east'
        if (a >= 22.5 && a < 67.5) return 'south-east'
        if (a >= 67.5 && a < 112.5) return 'south'
        if (a >= 112.5 && a < 157.5) return 'south-west'
        if (a >= 157.5 || a < -157.5) return 'west'
        if (a >= -157.5 && a < -112.5) return 'north-west'
        if (a >= -112.5 && a < -67.5) return 'north'
        return 'north-east'
      }

      const layer = new Container(), fxLayer = new Container()
      layer.sortableChildren = true
      app.stage.addChild(layer, fxLayer)

      const updateHp = (s: SpriteState) => {
        s.hpBar.clear()
        if (s.hp <= 0) return
        const r = Math.max(0, s.hp / s.maxHp)
        s.hpBar.rect(-10, 0, 20, 3).fill({ color: 0x555555 }).rect(-10, 0, 20 * r, 3).fill({ color: r > 0.5 ? 0x4ade80 : 0xef4444 })
      }

      const createU = (u: UnitRow, t: 'attacker'|'defender') => {
        const c = new Container()
        c.x = (Number(u.grid_x||0)) * TILE_SIZE + TILE_SIZE / 2
        c.y = (Number(u.grid_y||0)) * TILE_SIZE + TILE_SIZE / 2
        layer.addChild(c)
        
        let g: Graphics | undefined
        let s: Sprite | undefined
        let basePath: string | undefined

        const spritePaths: Record<string, string> = {
          'marine': '/sprites/marine/rotations',
          'rocketeer': '/sprites/rocketeer',
          'exosuit': '/sprites/exosuit',
          'sniper': '/sprites/sniper',
          'medic': '/sprites/medic',
          'turret': '/sprites/turret'
        }

        if (spritePaths[u.unit_type]) {
          basePath = spritePaths[u.unit_type]
          const tex = Texture.from(`${basePath}/${t === 'attacker' ? 'north' : 'south'}.png`)
          s = new Sprite(tex)
          s.anchor.set(0.5, 0.8)
          // Textures are 128x128. Set scale explicitly.
          const scaleMult = u.unit_type === 'exosuit' ? 2.5 : 1.8
          s.scale.set((TILE_SIZE * scaleMult) / 128)
          c.addChild(s)
        } else {
          g = new Graphics()
          const col = t === 'attacker' ? 0x3b82f6 : 0xef4444
          g.circle(0, 0, 14).fill({ color: col })
          c.addChild(g)
          const txt = new Text({ text: u.unit_type[0].toUpperCase(), style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' } })
          txt.anchor.set(0.5); c.addChild(txt)
        }

        const hpBar = new Graphics(); hpBar.y = -5
        c.addChild(hpBar)

        if (!u.id) return
        const maxHp = UNIT_TYPES[u.unit_type as UnitTypeKey]?.baseStats.hp || u.hp_current
        sprites[u.id] = { c, g, s, hpBar, hp: u.hp_current, maxHp, prog: 1, sX: c.x, sY: c.y, tX: c.x, tY: c.y, type: u.unit_type, team: t, basePath }
        updateHp(sprites[u.id])
      }

      attackerUnits.forEach(u => createU(u, 'attacker')); defenderUnits.forEach(u => createU(u, 'defender'))

      let tick = 0, time = 0
      const DUR = 600
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
        if (time >= DUR) {
          time -= DUR
          if (tick < logs.length) {
            logs[tick].actions.forEach(a => {
              const s = sprites[a.unitId]
              if (!s) return
              if (a.type === 'move') {
                s.sX = s.c.x; s.sY = s.c.y; s.tX = a.toX! * TILE_SIZE + TILE_SIZE/2; s.tY = a.toY! * TILE_SIZE + TILE_SIZE/2; s.prog = 0
                if (s.s && s.basePath) {
                  s.s.texture = Texture.from(`${s.basePath}/${getDir(s.tX - s.sX, s.tY - s.sY)}.png`)
                }
              } else if (a.type === 'attack' || a.type === 'heal') {
                const tg = sprites[a.targetId!]
                if (tg) {
                  const isH = a.type === 'heal', pCol = isH ? 0x4ade80 : 0xffaa00
                  spawnProj(s.c.x, s.c.y, tg.c.x, tg.c.y, pCol)
                  if (s.s && s.basePath) {
                    s.s.texture = Texture.from(`${s.basePath}/${getDir(tg.c.x - s.c.x, tg.c.y - s.c.y)}.png`)
                  }
                  tg.hp = isH ? Math.min(tg.maxHp, tg.hp + (a.damage || 0)) : tg.hp - (a.damage || 0)
                  updateHp(tg)
                  s.c.scale.set(1.2); setTimeout(() => { if (!s.c.destroyed) s.c.scale.set(1) }, 150)
                }
              
              } else if (a.type === 'spawn') {
                createU({
                  id: a.targetId || a.unitId + '_spawn_' + tick,
                  unit_type: a.spawnType || 'turret',
                  hp_current: a.spawnMaxHp || 200,
                  grid_x: String(a.toX),
                  grid_y: String(a.toY)
                } as unknown as import('@/domains/combat/combat.types').UnitRow, (a.spawnTeam || s.team) as 'attacker' | 'defender')
                spawnTxt('SPAWN', a.toX! * TILE_SIZE + TILE_SIZE/2, a.toY! * TILE_SIZE + TILE_SIZE/2, 0x00aaff)
              } else if (a.type === 'die') {
                s.c.alpha = 0.3; s.hpBar.clear()
                s.c.addChild(new Graphics().moveTo(-10, -10).lineTo(10, 10).moveTo(10, -10).lineTo(-10, 10).stroke({ color: 0x0, width: 3 }))
              }
            })
            tick++
          }
        }
        Object.values(sprites).forEach(s => {
          if (s.prog < 1) {
            s.prog = Math.min(1, s.prog + dt / DUR)
            s.c.x = s.sX + (s.tX - s.sX) * s.prog; s.c.y = s.sY + (s.tY - s.sY) * s.prog
          }
          s.c.zIndex = s.c.y // 3/4 perspective depth sorting
        })
        for (let i = projs.length - 1; i >= 0; i--) {
          const p = projs[i]
          if ((p.p += dt / (DUR * 0.5)) >= 1) {
            spawnTxt(p.col === 0x4ade80 ? '+HP' : '-DMG', p.tX, p.tY, p.col)
            p.g.destroy(); projs.splice(i, 1)
          } else {
            p.g.x = p.sX + (p.tX - p.sX) * p.p; p.g.y = p.sY + (p.tY - p.sY) * p.p
          }
        }
        for (let i = fts.length - 1; i >= 0; i--) {
          if ((fts[i].life -= dt / 1000) <= 0) { fts[i].c.destroy(); fts.splice(i, 1) }
          else { fts[i].c.y -= 0.5; fts[i].c.alpha = fts[i].life }
        }
      })
    }
    initPixi()
    return () => { isDestroyed = true; if (app) app.destroy(true, { children: true, texture: true, context: true }) }
  }, [attackerUnits, defenderUnits, logs])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
      <div className="p-4 flex justify-between items-center shrink-0 border-b border-gray-800 bg-gray-900">
        <div><h2 className="text-lg font-bold text-white">Боевой отчет</h2><p className="text-xs text-blue-400">Синие — атака, Красные — защита</p></div>
        <button onClick={onClose} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold text-white shadow-lg">ЗАКРЫТЬ</button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-4">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]" style={{ height: '100%', maxHeight: '100%', aspectRatio: '10/18' }} />
      </div>
    </div>
  )
})
