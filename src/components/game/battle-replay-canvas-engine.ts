import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleAction, BattleTick } from '@/domains/combat/combat.types'
import { buildReplayRenderUnits } from './battle-replay-state'
import { drawReplay } from './battle-replay-canvas-draw'
import {
  applyHpDelta,
  createReplayUnit,
  createSpawnedUnit,
  handleStatusAction,
  hazardColor,
  hazardLabel,
  updateAged,
} from './battle-replay-canvas-events'
import type { BattleReplayEngineProps, FloatingText, HazardFx, Projectile, ReplayAppHandle, ReplayControls, ReplayUnit } from './battle-replay-canvas-types'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS, TICK_MS } from './battle-replay-canvas-types'
import { applyReplayMovement } from './battle-replay-movement'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls } from './battle-replay-canvas-types'

export async function startBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, attackerUnits, defenderUnits, initialState, logs, obstacles, onTickChange } = props
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is unavailable')

  const dpr = window.devicePixelRatio || 1
  canvas.width = FIELD_WIDTH * dpr
  canvas.height = FIELD_HEIGHT * dpr
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.objectFit = 'contain'
  canvas.style.background = '#1a1a2e'
  container.appendChild(canvas)

  const renderUnits = buildReplayRenderUnits(attackerUnits, defenderUnits, logs, initialState)
  const createInitialUnits = (): Record<string, ReplayUnit> => {
    const nextUnits: Record<string, ReplayUnit> = {}
    renderUnits.forEach(({ unit, team, isSimUnit }) => {
      const replayUnit = createReplayUnit(unit, team, isSimUnit)
      if (replayUnit) nextUnits[replayUnit.id] = replayUnit
    })
    return nextUnits
  }

  let isPlaying = true
  let playbackSpeed = 1
  let overlays = { radius: false, velocity: false, targets: false }
  let units = createInitialUnits()
  let tick = 0
  let tickTime = 0
  let renderProgressOverride: number | null = null
  let lastNotifiedTick = -1
  let lastFrame = performance.now()
  let animationFrame = 0
  const floatingTexts: FloatingText[] = []
  const projectiles: Projectile[] = []
  const hazards: HazardFx[] = []

  const controls: ReplayControls = {
    play: () => {
      if (renderProgressOverride !== null) {
        settleUnits()
        renderProgressOverride = null
      }
      isPlaying = true
    },
    pause: () => { isPlaying = false },
    seekToTick: (nextTick: number) => { seekToTick(nextTick) },
    getCurrentTick: () => tick,
    getTotalTicks: () => logs.length,
    setSpeed: (speed: number) => { playbackSpeed = speed },
    setOverlays: (next) => { overlays = next },
  }

  const spawnText = (text: string, x: number, y: number, color: string) => {
    floatingTexts.push({ text, x, y: y - 20, color, age: 0 })
  }
  const spawnProjectile = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    projectiles.push({ x1, y1, x2, y2, color, age: 0 })
  }
  const spawnHazard = (action: BattleAction) => {
    hazards.push({
      x: action.toX ?? FIELD_WIDTH / 2,
      y: action.toY ?? FIELD_HEIGHT / 2,
      radius: action.radius ?? 60,
      color: hazardColor(action.statusType),
      label: hazardLabel(action.statusType),
      age: 0,
    })
  }

  const clearTransientVisuals = () => {
    floatingTexts.length = 0
    projectiles.length = 0
    hazards.length = 0
  }
  const settleUnits = () => {
    Object.values(units).forEach(unit => {
      unit.sX = unit.tX
      unit.sY = unit.tY
      unit.flash = 0
    })
  }
  const clearUnitFlashes = () => {
    Object.values(units).forEach(unit => { unit.flash = 0 })
  }
  const notifyTickChange = () => {
    if (tick === lastNotifiedTick) return
    lastNotifiedTick = tick
    onTickChange?.(tick)
  }

  const processTick = (battleTick: BattleTick, emitVisuals = true) => {
    const emitText = emitVisuals ? spawnText : () => {}
    const emitProjectile = emitVisuals ? spawnProjectile : () => {}
    Object.values(units).forEach(unit => {
      unit.sX = unit.tX
      unit.sY = unit.tY
    })
    const movedUnitIds = new Set<string>()
    battleTick.actions.forEach(action => {
      const source = units[action.unitId]
      const target = action.targetId ? units[action.targetId] : undefined
      if (action.type === 'move' || action.type === 'knockback') {
        if (!source) return
        applyReplayMovement(source, action, movedUnitIds)
        return
      }
      if (action.type === 'attack' || action.type === 'heal') {
        handleAttackAction(action, source, target, emitText, emitProjectile)
        return
      }
      if (action.type === 'damage' || action.type === 'damage_share') {
        handleDamageAction(action, target, emitText)
        return
      }
      if (action.type === 'lifesteal') {
        handleLifestealAction(action, target ?? source, emitText)
        return
      }
      if (action.type === 'die' && source) {
        source.isDead = true
        source.hp = 0
        emitText('ВЫВЕДЕН', source.tX, source.tY, '#cbd5e1')
        return
      }
      if (action.type === 'spawn' && action.targetId) {
        units[action.targetId] = createSpawnedUnit(action)
        emitText('СПАВН', action.toX ?? FIELD_WIDTH / 2, action.toY ?? FIELD_HEIGHT / 2, '#86efac')
        return
      }
      if (action.type === 'hazard_spawn') {
        if (emitVisuals) spawnHazard(action)
        return
      }
      handleStatusAction(action, source, target, emitText, emitProjectile)
    })
  }

  const seekToTick = (nextTick: number) => {
    const targetTick = Math.max(0, Math.min(logs.length, Math.round(nextTick)))
    units = createInitialUnits()
    clearTransientVisuals()
    tick = 0
    tickTime = 0
    while (tick < targetTick) {
      processTick(logs[tick], false)
      tick++
    }
    clearUnitFlashes()
    renderProgressOverride = targetTick > 0 ? 1 : 0
    lastFrame = performance.now()
    notifyTickChange()
  }

  const step = (dt: number) => {
    if (renderProgressOverride !== null) {
      settleUnits()
      renderProgressOverride = null
    }
    tickTime += dt
    while (tickTime >= TICK_MS && tick < logs.length) {
      tickTime -= TICK_MS
      processTick(logs[tick])
      tick++
    }
    notifyTickChange()
    updateAged(floatingTexts, dt, FLOAT_MS)
    updateAged(projectiles, dt, PROJECTILE_MS)
    updateAged(hazards, dt, HAZARD_MS)
    Object.values(units).forEach(unit => { unit.flash = Math.max(0, unit.flash - dt / 220) })
  }

  const renderLoop = (now: number) => {
    const rawDt = Math.min(80, now - lastFrame)
    lastFrame = now
    if (isPlaying) step(rawDt * playbackSpeed)
    const progress = renderProgressOverride ?? Math.min(1, tickTime / TICK_MS)
    drawReplay(ctx, dpr, units, obstacles ?? [], hazards, projectiles, floatingTexts, overlays, progress)
    animationFrame = requestAnimationFrame(renderLoop)
  }

  animationFrame = requestAnimationFrame(renderLoop)
  notifyTickChange()

  const cleanupEvents = () => {
    cancelAnimationFrame(animationFrame)
    canvas.remove()
  }
  const app: ReplayAppHandle = { canvas, destroy: cleanupEvents }
  return { app, cleanupEvents, controls }
}

function handleAttackAction(
  action: BattleAction,
  source: ReplayUnit | undefined,
  target: ReplayUnit | undefined,
  spawnText: (text: string, x: number, y: number, color: string) => void,
  spawnProjectile: (x1: number, y1: number, x2: number, y2: number, color: string) => void
) {
  if (!source || !target) return
  const color = action.type === 'heal' ? '#4ade80' : action.isShieldHit ? '#60a5fa' : '#f59e0b'
  spawnProjectile(source.tX, source.tY, target.tX, target.tY, color)
  source.flash = 1
  if (action.damage === undefined) return
  applyHpDelta(target, action.type === 'heal' ? action.damage : -action.damage)
  spawnText(action.type === 'heal' ? `+${action.damage}` : `-${action.damage}`, target.tX, target.tY, color)
}

function handleDamageAction(action: BattleAction, target: ReplayUnit | undefined, spawnText: (text: string, x: number, y: number, color: string) => void) {
  if (!target || action.damage === undefined) return
  applyHpDelta(target, -action.damage)
  spawnText(action.type === 'damage_share' ? `РАЗДЕЛ -${action.damage}` : `-${action.damage}`, target.tX, target.tY, '#f59e0b')
}

function handleLifestealAction(action: BattleAction, target: ReplayUnit | undefined, spawnText: (text: string, x: number, y: number, color: string) => void) {
  if (!target || action.damage === undefined) return
  applyHpDelta(target, action.damage)
  spawnText(`+${action.damage}`, target.tX, target.tY, '#4ade80')
}
