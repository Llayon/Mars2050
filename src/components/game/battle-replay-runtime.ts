import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleAction } from '@/domains/combat/combat.types'
import { buildReplayRenderUnits } from './battle-replay-state'
import {
  createReplayUnit,
  hazardColor,
  hazardLabel,
  updateAged,
  updateReplayUnitAges,
} from './battle-replay-canvas-events'
import type { BattleReplayEngineProps, FloatingText, HazardFx, Projectile, ReplayControls } from './battle-replay-canvas-types'
import { FLOAT_MS, HAZARD_MS, PROJECTILE_MS, TICK_MS } from './battle-replay-canvas-types'
import {
  clearReplayRuntimeRoster,
  createReplayRuntimeRoster,
  setReplayRuntimeUnit,
} from './battle-replay-runtime-roster'
import { createReplayTickProcessor } from './battle-replay-runtime-actions'
import type { BattleReplayRuntime, ReplayFrameState } from './battle-replay-runtime-state'
export type { BattleReplayRuntime, ReplayFrameState } from './battle-replay-runtime-state'

export function createBattleReplayRuntime(props: BattleReplayEngineProps): BattleReplayRuntime {
  const { attackerUnits, defenderUnits, initialState, logs, onTickChange } = props
  const renderUnits = buildReplayRenderUnits(attackerUnits, defenderUnits, logs, initialState)
  const roster = createReplayRuntimeRoster()
  const { units, unitList } = roster
  resetInitialUnits()

  let isPlaying = true
  let playbackSpeed = 1
  let overlays = { radius: false, velocity: false, targets: false }
  let tick = 0
  let tickTime = 0
  let renderProgressOverride: number | null = null
  let lastNotifiedTick = -1
  let lastFrame = nowMs()
  const floatingTexts: FloatingText[] = []
  const projectiles: Projectile[] = []
  const hazards: HazardFx[] = []
  const frameState: ReplayFrameState = {
    units,
    unitList,
    hazards,
    projectiles,
    texts: floatingTexts,
    overlays,
    progress: 0,
    replayTimeMs: 0,
  }
  const processTick = createReplayTickProcessor({
    roster,
    spawnText,
    spawnProjectile,
    spawnHazard,
  })

  const controls: ReplayControls = {
    play: () => {
      if (renderProgressOverride !== null) {
        settleUnits()
        renderProgressOverride = null
      }
      isPlaying = true
    },
    pause: () => { isPlaying = false },
    seekToTick: nextTick => { seekToTick(nextTick) },
    stepTick: () => { stepTick() },
    getCurrentTick: () => tick,
    getTotalTicks: () => logs.length,
    setSpeed: speed => { playbackSpeed = speed },
    setOverlays: next => { overlays = next },
  }

  const frame = (now: number): ReplayFrameState => {
    const rawDt = Math.min(80, now - lastFrame)
    lastFrame = now
    if (isPlaying) step(rawDt * playbackSpeed)
    return snapshot()
  }

  const snapshot = (): ReplayFrameState => {
    frameState.overlays = overlays
    frameState.progress =
      renderProgressOverride ?? Math.min(1, tickTime / TICK_MS)
    frameState.replayTimeMs = getReplayTimeMs(tick, frameState.progress)
    return frameState
  }

  notifyTickChange()
  return { controls, frame, snapshot }

  function resetInitialUnits() {
    clearReplayRuntimeRoster(roster)
    for (let index = 0; index < renderUnits.length; index++) {
      const { unit, team, isSimUnit } = renderUnits[index]
      const replayUnit = createReplayUnit(unit, team, isSimUnit)
      if (replayUnit) setReplayRuntimeUnit(roster, replayUnit)
    }
  }

  function spawnText(text: string, x: number, y: number, color: string) {
    floatingTexts.push({ text, x, y: y - 20, color, age: 0 })
  }

  function spawnProjectile(x1: number, y1: number, x2: number, y2: number, color: string) {
    projectiles.push({ x1, y1, x2, y2, color, age: 0 })
  }

  function spawnHazard(action: BattleAction) {
    hazards.push({
      x: action.toX ?? FIELD_WIDTH / 2,
      y: action.toY ?? FIELD_HEIGHT / 2,
      radius: action.radius ?? 60,
      color: hazardColor(action.statusType),
      label: hazardLabel(action.statusType),
      age: 0,
    })
  }

  function clearTransientVisuals() {
    floatingTexts.length = 0
    projectiles.length = 0
    hazards.length = 0
  }

  function settleUnits() {
    for (let index = 0; index < unitList.length; index++) {
      const unit = unitList[index]
      unit.sX = unit.tX
      unit.sY = unit.tY
      unit.flash = 0
    }
  }

  function clearUnitFlashes() {
    for (let index = 0; index < unitList.length; index++) {
      unitList[index].flash = 0
    }
  }

  function notifyTickChange() {
    if (tick === lastNotifiedTick) return
    lastNotifiedTick = tick
    onTickChange?.(tick)
  }

  function seekToTick(nextTick: number) {
    const targetTick = Math.max(0, Math.min(logs.length, Math.round(nextTick)))
    resetInitialUnits()
    clearTransientVisuals()
    tick = 0
    tickTime = 0
    while (tick < targetTick) {
      processTick(logs[tick], tick * TICK_MS, false)
      tick++
    }
    for (let index = 0; index < unitList.length; index++) {
      if (unitList[index].isDead) {
        unitList[index].deathAgeMs = Number.POSITIVE_INFINITY
      }
    }
    clearUnitFlashes()
    renderProgressOverride = targetTick > 0 ? 1 : 0
    lastFrame = nowMs()
    notifyTickChange()
  }

  function stepTick() {
    isPlaying = false
    settleUnits()
    clearTransientVisuals()
    tickTime = 0
    renderProgressOverride = null
    if (tick >= logs.length) return
    processTick(logs[tick], tick * TICK_MS)
    tick++
    renderProgressOverride = 1
    notifyTickChange()
  }

  function step(dt: number) {
    if (renderProgressOverride !== null) {
      settleUnits()
      renderProgressOverride = null
    }
    tickTime += dt
    while (tickTime >= TICK_MS && tick < logs.length) {
      tickTime -= TICK_MS
      processTick(logs[tick], tick * TICK_MS)
      tick++
    }
    notifyTickChange()
    updateAged(floatingTexts, dt, FLOAT_MS)
    updateAged(projectiles, dt, PROJECTILE_MS)
    updateAged(hazards, dt, HAZARD_MS)
    updateReplayUnitAges(unitList, dt)
  }
}

function nowMs(): number { return typeof performance === 'undefined' ? Date.now() : performance.now() }

function getReplayTimeMs(tick: number, progress: number): number {
  if (tick === 0) return 0
  return Math.max(0, (tick - 1 + progress) * TICK_MS)
}
