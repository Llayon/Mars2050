import { Application, Graphics, Text, Container, Assets, Sprite, Texture } from 'pixi.js'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { UNIT_VISUALS } from './battle-replay-visuals'
import { FIELD_WIDTH, FIELD_HEIGHT, getDir, SPRITE_PATHS, SPRITE_ATLASES, SPRITE_DIRS, SVG_UNITS } from '@/domains/combat/combat.utils'
import type { BattleTick, UnitRow, SimUnit, UnitTypeKey, Obstacle } from '@/domains/combat/combat.types'
import { setupCameraControls } from './battle-replay-camera'
import { processVisualEffects, lerp } from './battle-replay-utils'
import { drawOverlays } from './battle-replay-overlays'
import { createU, getSvgFrameTexture, updateHp } from './battle-replay-units'
import type { SpriteState } from './battle-replay-units'
import { addVisualAnimationAssets, getVisualAnimationTexture } from './battle-replay-animation-sequences'
import { applyProceduralMotion, updateParticles, initMotionVfx } from './battle-replay-motion-vfx'
import { buildReplayRenderUnits } from './battle-replay-state'
import { hasDetailedDamageEvents } from './battle-replay-damage-events'

export interface ReplayControls {
  play: () => void;
  pause: () => void;
  setSpeed: (s: number) => void;
  setOverlays: (o: { radius: boolean; velocity: boolean; targets: boolean }) => void;
}

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
  let cleanupEvents: (() => void) | null = null
  const useDetailedDamageEvents = hasDetailedDamageEvents(logs)

  const app = new Application(), BOARD_W = FIELD_WIDTH, BOARD_H = FIELD_HEIGHT
  await app.init({ width: BOARD_W, height: BOARD_H, backgroundColor: 0x1a1a2e, resolution: window.devicePixelRatio || 1, autoDensity: true })

  initMotionVfx()

  let isPlaying = true, playbackSpeed = 1
  let overlays = { radius: false, velocity: false, targets: false }

  const controls: ReplayControls = {
    play: () => { isPlaying = true },
    pause: () => { isPlaying = false },
    setSpeed: (s: number) => { playbackSpeed = s },
    setOverlays: (o: { radius: boolean; velocity: boolean; targets: boolean }) => { overlays = o }
  }

  container.appendChild(app.canvas)
  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  app.canvas.style.objectFit = 'contain'

  try {
    const toLoad = ['/sprites/crater.svg']
    for (const t in SPRITE_PATHS) for (const d of SPRITE_DIRS) toLoad.push(`${SPRITE_PATHS[t]}/${d}.png`)
    for (const t in SPRITE_ATLASES) toLoad.push(SPRITE_ATLASES[t])
    for (const t of SVG_UNITS) toLoad.push(`/assets/units/${t}_8dir.svg`)
    Object.values(UNIT_VISUALS).forEach(v => { if (v.fxType) toLoad.push(`/assets/units/${v.fxType}.svg`) })
    addVisualAnimationAssets(toLoad)
    await Assets.load([...new Set(toLoad)])
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

  const sprites: Record<string, SpriteState> = {}

  const layer = new Container(), fxLayer = new Container(), overlayGfx = new Graphics()
  layer.sortableChildren = true
  world.addChild(layer, fxLayer, overlayGfx)
  buildReplayRenderUnits(attackerUnits, defenderUnits, logs, initialState).forEach(({ unit, team, isSimUnit }) => {
    createU(unit, team, isSimUnit, layer, sprites)
  })

  let tick = 0, time = 0, globalTime = 0
  const DUR = 150
  type FX = { c: Container, life: number }
  type Proj = { g: Graphics, sX: number, sY: number, tX: number, tY: number, p: number, col: number }
  type HazardFX = { g: Graphics, life: number }
  const fts: FX[] = [], projs: Proj[] = [], hazardFxs: HazardFX[] = []
  const spawnTxt = (t: string, x: number, y: number, c: number) => {
    const txt = new Text({ text: t, style: { fill: c, fontSize: 18, fontWeight: 'bold', dropShadow: { alpha: 0.5 } } })
    txt.anchor.set(0.5); txt.position.set(x, y - 20); fxLayer.addChild(txt); fts.push({ c: txt, life: 1 })
  }
  const spawnProj = (x1: number, y1: number, x2: number, y2: number, c: number) => {
    const p = new Graphics().circle(0, 0, 4).fill({ color: c }); p.position.set(x1, y1)
    fxLayer.addChild(p); projs.push({ g: p, sX: x1, sY: y1, tX: x2, tY: y2, p: 0, col: c })
  }

  app.ticker.add(({ deltaMS: dt }) => {
    if (!isPlaying) return
    time += dt * playbackSpeed
    globalTime += dt * playbackSpeed

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
            if (a.isWalking !== false) s.act = 'walk'
          }
        } else if (a.type === 'attack' || a.type === 'heal') {
          const tg = sprites[a.targetId!]
          if (tg) {
            const isH = a.type === 'heal', pCol = isH ? 0x4ade80 : (a.isShieldHit ? 0x3b82f6 : 0xffaa00)
            const hasLegacyDamage = typeof a.damage === 'number'
            spawnProj(s.c.x, s.c.y, tg.c.x, tg.c.y, pCol)
            if (s.s) {
              s.dir = getDir(tg.c.x - s.c.x, tg.c.y - s.c.y);
              s.act = 'shoot'
            }

            if (isH || (!useDetailedDamageEvents && hasLegacyDamage)) {
              tg.hp -= isH ? -a.damage! : a.damage!
              updateHp(tg)
              const dmgText = isH ? `+${a.damage}` : (a.isShieldHit && a.damage === 0 ? `БЛОК` : `-${a.damage}`)
              spawnTxt(dmgText, tg.c.x, tg.c.y, pCol)
            }

            if (s.s && s.baseScale !== undefined) {
               s.s.scale.set(s.baseScale * 1.2)
            }

            if (s.s && !isH) {
              const vConf = UNIT_VISUALS[s.type as UnitTypeKey] || {};
              if (vConf.recoilPx) {
                 s.recoilAngle = Math.atan2(tg.c.y - s.c.y, tg.c.x - s.c.x);
                 s.recoil = vConf.recoilPx;
              }
              const flashType = vConf.fxType || 'fx_muzzle_orange';
              const mOff = vConf.muzzleOffset || 25;
              try {
                const flash = new Sprite(Texture.from(`/assets/units/${flashType}.svg`));
                flash.anchor.set(0.5);
                flash.scale.set(0.5 * (vConf.vfxScale || 1.0));
                const aRad = Math.atan2(tg.c.y - s.c.y, tg.c.x - s.c.x);
                flash.rotation = aRad + Math.PI/2;
                flash.x = s.c.x + Math.cos(aRad) * mOff;
                flash.y = s.c.y + Math.sin(aRad) * mOff;
                flash.blendMode = 'add';
                fxLayer.addChild(flash);
                fts.push({ c: flash, life: 0.15 });
              } catch(e) {}
            }
          }
        } else if (a.type === 'damage') {
          const tg = sprites[a.targetId!]
          if (tg) {
            tg.hp -= a.damage!
            updateHp(tg)
            spawnTxt(`-${a.damage}`, tg.c.x, tg.c.y, 0xffaa00)
          }
        } else if (a.type === 'shield_damage') {
          const tg = sprites[a.targetId!]
          if (tg) spawnTxt(`ЩИТ -${a.damage}`, tg.c.x, tg.c.y, 0x3b82f6)
        } else if (a.type === 'shield_break') {
          const tg = sprites[a.targetId!]
          if (tg) spawnTxt('ЩИТ СЛОМАН', tg.c.x, tg.c.y, 0x60a5fa)
        } else if (a.type === 'lifesteal') {
          const tg = sprites[a.targetId ?? a.unitId]
          if (tg) {
            tg.hp = Math.min(tg.maxHp, tg.hp + (a.damage ?? 0))
            updateHp(tg)
            spawnTxt(`+${a.damage}`, tg.c.x, tg.c.y, 0x4ade80)
          }
        } else if (a.type === 'unit_blocked_damage') {
          spawnTxt(`БЛОК ${a.damage}`, s.c.x, s.c.y, 0x94a3b8)
        } else if (a.type === 'die') {
          s.c.alpha = 0.3; s.hpBar.alpha = 0
          if (s.s) s.s.tint = 0x555555
        } else if (a.type === 'spawn') {
          createU({ id: a.targetId!, unit_type: a.spawnType! as UnitTypeKey, grid_x: String(a.toX!), grid_y: String(a.toY!), hp_current: a.spawnMaxHp!, colony_id: '1', tier: 1, upgrade_path: [] }, a.spawnTeam as 'attacker'|'defender', false, layer, sprites)
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
    const animFPS = 6
    const fIdx = Math.floor(globalTime / (1000 / animFPS)) % 6

    Object.values(sprites).forEach(s => {
      s.c.x = lerp(s.sX, s.tX, prog); s.c.y = lerp(s.sY, s.tY, prog)
      s.c.zIndex = s.c.y
      if (s.s && s.isAtlas && s.act && s.dir) {
         let f = fIdx;
         if (s.act === 'shoot') f = Math.min(5, Math.floor((time / DUR) * 6));
         else if (s.act === 'idle') f = 0;
         s.s.texture = Texture.from(`${s.type}_${s.act}_${s.dir}_00${s.act === 'idle' ? '' : (f + 1)}`)
      } else if (s.s && s.isSvg && s.dir) {
         const texture = getSvgFrameTexture(s.type, s.dir); if (texture) s.s.texture = texture
      } else if (s.s && s.basePath && s.dir) {
         s.s.texture = getVisualAnimationTexture(s, globalTime) ?? Texture.from(`${s.basePath}/${s.dir}.png`)
      }

      applyProceduralMotion(s, { dt, globalTime }, fxLayer)

      if (s.s && s.baseScale !== undefined) {
         s.s.scale.x = lerp(s.s.scale.x, s.baseScale, 0.1)
         s.s.scale.y = lerp(s.s.scale.y, s.baseScale, 0.1)
      }
    })
    layer.sortChildren()

    updateParticles(dt * playbackSpeed)
    processVisualEffects(fts, projs, hazardFxs, dt * playbackSpeed)
    drawOverlays(overlayGfx, overlays, sprites, projs)
  })

  cleanupEvents = setupCameraControls(app, world)

  return { app, cleanupEvents, controls }
}
