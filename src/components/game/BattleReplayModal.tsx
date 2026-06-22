'use client'
import { useEffect, useRef, memo } from 'react'
import { Application, Graphics, Text, Container, Assets, Sprite, Texture } from 'pixi.js'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { FIELD_WIDTH, FIELD_HEIGHT } from '@/domains/combat/combat.utils'
import type { BattleTick, UnitRow, UnitTypeKey, SimUnit } from '@/domains/combat/combat.types'

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, initialState, logs, onClose }: { attackerUnits: UnitRow[], defenderUnits: UnitRow[], initialState?: SimUnit[], logs: BattleTick[], onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let app: Application, isDestroyed = false, isReady = false
    async function initPixi() {
      app = new Application()
      const TILE_SIZE = 40, BOARD_W = FIELD_WIDTH, BOARD_H = FIELD_HEIGHT
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
          'turret': '/sprites/turret',
          'alien_bug': '/sprites/alien_bug',
          'alien_spitter': '/sprites/alien_spitter'
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
      
      const world = new Container()
      world.pivot.set(BOARD_W / 2, BOARD_H / 2)
      world.x = BOARD_W / 2
      world.y = BOARD_H / 2
      // Default zoom 1.0 so whole field is visible
      world.scale.set(1.0)
      app.stage.addChild(world)
      
      const gridContainer = new Container()
      world.addChild(gridContainer)

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
        team: 'attacker'|'defender',
        basePath?: string,
        baseScale?: number
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

        const spritePaths: Record<string, string> = {
          'marine': '/sprites/marine/rotations',
          'rocketeer': '/sprites/rocketeer',
          'exosuit': '/sprites/exosuit',
          'sniper': '/sprites/sniper',
          'medic': '/sprites/medic',
          'turret': '/sprites/turret',
          'alien_bug': '/sprites/alien_bug',
          'alien_spitter': '/sprites/alien_spitter'
        }

        if (spritePaths[utype]) {
          basePath = spritePaths[utype]
          const tex = Texture.from(`${basePath}/${t === 'attacker' ? 'north' : 'south'}.png`)
          s = new Sprite(tex)
          s.anchor.set(0.5, 0.8)
          // Textures are 128x128. Set scale explicitly.
          const scaleMult = utype === 'exosuit' ? 2.5 : 1.8
          const baseScale = (TILE_SIZE * scaleMult) / 128
          s.scale.set(baseScale)
          c.addChild(s)
        } else {
          g = new Graphics()
          const col = t === 'attacker' ? 0x3b82f6 : 0xef4444
          g.circle(0, 0, 14).fill({ color: col })
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
          
          // By default, units stand still at their current target position
          Object.values(sprites).forEach(s => {
            s.sX = s.tX; s.sY = s.tY;
          })

          logs[tick].actions.forEach(a => {
            const s = sprites[a.unitId]
            if (!s) return
            if (a.type === 'move') {
              // Use exact mathematical positions from the server log
              s.sX = a.fromX!; s.sY = a.fromY!
              s.tX = a.toX!; s.tY = a.toY!
              if (s.s && s.basePath) {
                if (a.facingAngle !== undefined) {
                   // Use the mathematically correct facing angle from the engine!
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
                
                // Pulse animation
                if (s.s) {
                  const originalScale = s.baseScale || 1
                  const pulse = () => {
                    s.s!.scale.set(originalScale * 1.3)
                    setTimeout(() => { if (!s.s!.destroyed) s.s!.scale.set(originalScale) }, 100)
                  }
                  pulse()
                }

                tg.hp = isH ? Math.min(tg.maxHp, tg.hp + (a.damage || 0)) : tg.hp - (a.damage || 0)
                updateHp(tg)
              }
            
            } else if (a.type === 'spawn') {
              createU({
                id: a.targetId || a.unitId + '_spawn_' + tick,
                unit_type: a.spawnType || 'turret',
                hp_current: a.spawnMaxHp || 200,
                grid_x: String(a.toX),
                grid_y: String(a.toY)
              } as unknown as import('@/domains/combat/combat.types').UnitRow, (a.spawnTeam || s.team) as 'attacker' | 'defender', false)
              spawnTxt('SPAWN', a.toX!, a.toY!, 0x00aaff)
            } else if (a.type === 'die') {
              s.c.alpha = 0.5; s.hpBar.clear()
              if (s.s) {
                s.s.rotation = Math.PI / 2
                s.s.tint = 0x555555
              } else if (s.g) {
                s.g.clear()
                s.g.circle(0, 0, 14).fill({ color: 0x333333 })
              }
            }
          })
          tick++
        }
        
        // Exact interpolation based on elapsed time within the current tick
        const globalProg = tick >= logs.length ? 1 : Math.min(1, time / DUR)
        
        Object.values(sprites).forEach(s => {
          s.c.x = s.sX + (s.tX - s.sX) * globalProg
          s.c.y = s.sY + (s.tY - s.sY) * globalProg
          
          const isF = s.type === 'drone'
          s.c.zIndex = isF ? 9000 + s.c.y : s.c.y
          // Wait, 'time' here wraps around 0-DUR, we need a continuously growing time for sine wave
          if (isF) { 
            const absTime = performance.now();
            const yo = -30 + Math.sin(absTime * 0.005) * 5; 
            if (s.s) s.s.y = yo; 
            if (s.g) s.g.y = yo 
          }
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
      let isDragging = false
      let lastPos = { x: 0, y: 0 }
      
      const onPointerDown = (e: PointerEvent) => { isDragging = true; lastPos = { x: e.clientX, y: e.clientY } }
      const onPointerUp = () => isDragging = false
      const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return
        const rect = app.canvas.getBoundingClientRect()
        const scaleX = BOARD_W / rect.width
        const scaleY = BOARD_H / rect.height
        world.x += (e.clientX - lastPos.x) * scaleX
        world.y += (e.clientY - lastPos.y) * scaleY
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

      // Attach cleanup to app so we can call it in useEffect cleanup
      ;(app as any)._cleanupEvents = () => {
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointermove', onPointerMove)
      }

      isReady = true
    }
    initPixi()
    return () => { 
      isDestroyed = true
      if (app) {
        if ((app as any)._cleanupEvents) (app as any)._cleanupEvents()
        try { app.destroy(true) } catch(e) {}
      }
    }
  }, [attackerUnits, defenderUnits, initialState, logs])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-[60] w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-red-600 rounded-full text-white font-bold text-xl shadow-lg transition-colors border border-gray-600"
      >
        ✕
      </button>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-4">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]" style={{ height: '100%', maxHeight: '100%', aspectRatio: '1/2' }} />
      </div>
    </div>
  )
})
