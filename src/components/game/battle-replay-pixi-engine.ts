import { Application, Assets, Container, UPDATE_PRIORITY } from 'pixi.js'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleReplayEngineProps, ReplayAppHandle } from './battle-replay-canvas-types'
import { createBattleReplayRuntime } from './battle-replay-runtime'
import { drawPixiReplay } from './battle-replay-pixi-draw'
import { getBrowserReplayRenderBudget } from './battle-replay-quality'
import { createPixiReplayScene } from './battle-replay-pixi-scene'
import { resolveReplaySprite } from './battle-replay-sprites'
import { SPRITE_DIRS } from './battle-replay-visual-registry'
import {
  installReplayProfileExport,
  isReplayRenderProfilingEnabled,
  ReplayRenderProfiler,
} from './battle-replay-profile'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls } from './battle-replay-canvas-types'

export async function startPixiBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, logs, obstacles } = props
  const runtime = createBattleReplayRuntime(props)
  const initialUnits = runtime.snapshot().unitList
  const renderBudget = getBrowserReplayRenderBudget(initialUnits.length)
  await preloadReplayAssets(initialUnits.map(unit => unit.type), logs)

  const app = new Application()
  await app.init({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    backgroundColor: 0x1a1a2e,
    resolution: renderBudget.resolution,
    autoDensity: true,
  })

  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  app.canvas.style.display = 'block'
  app.canvas.style.objectFit = 'contain'
  app.canvas.style.background = '#1a1a2e'
  app.canvas.dataset.replayRenderer = 'pixi'
  container.appendChild(app.canvas)

  const root = new Container()
  root.sortableChildren = true
  app.stage.addChild(root)
  const scene = createPixiReplayScene(root, obstacles ?? [])
  const profiler = isReplayRenderProfilingEnabled()
    ? new ReplayRenderProfiler({
        unitCount: initialUnits.length,
        renderBudget,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        userAgent: window.navigator.userAgent,
      })
    : undefined
  const removeProfileExport = profiler
    ? installReplayProfileExport(app.canvas, profiler)
    : undefined

  const renderLoop = () => {
    const now = performance.now()
    profiler?.beginFrame(now)
    const runtimeStartedAt = profiler?.now() ?? 0
    const frame = runtime.frame(now)
    if (profiler) {
      profiler.recordRuntime(profiler.now() - runtimeStartedAt)
      profiler.setUnitCount(frame.unitList.length)
    }
    drawPixiReplay(scene, frame, renderBudget, profiler)
    if (process.env.NODE_ENV !== 'production') {
      app.canvas.dataset.replayTextColors = frame.texts.map(text => text.color).join(',')
      app.canvas.dataset.replayProjectileColors = frame.projectiles
        .map(projectile => projectile.color)
        .join(',')
    }
    profiler?.finishDraw(profiler.now())
  }
  const finishProfileFrame = () => profiler?.finishFrame(profiler.now())
  app.ticker.maxFPS = renderBudget.maxFps
  app.ticker.add(renderLoop)
  if (profiler) {
    app.ticker.add(
      finishProfileFrame,
      undefined,
      UPDATE_PRIORITY.UTILITY,
    )
  }
  renderLoop()

  const cleanupEvents = () => {
    app.ticker.remove(renderLoop)
    if (profiler) app.ticker.remove(finishProfileFrame)
    removeProfileExport?.()
    try { app.destroy(true, { children: true, texture: false, textureSource: false }) } catch {}
  }
  const replayApp: ReplayAppHandle = {
    canvas: app.canvas,
    destroy: cleanupEvents,
    getPerformanceProfile: () => profiler?.snapshot() ?? null,
  }
  return { app: replayApp, cleanupEvents, controls: runtime.controls }
}

async function preloadReplayAssets(initialTypes: string[], logs: BattleReplayEngineProps['logs']) {
  const types = new Set(initialTypes)
  logs.forEach(tick => {
    tick.actions.forEach(action => {
      if (action.spawnType) types.add(action.spawnType)
    })
  })

  const sources = new Set<string>()
  types.forEach(type => {
    SPRITE_DIRS.forEach(direction => {
      const sprite = resolveReplaySprite(type, direction)
      if (sprite) sources.add(sprite.src)
    })
  })
  if (sources.size === 0) return

  try {
    await Assets.load([...sources])
  } catch (error) {
    console.warn('Pixi replay asset preload failed; renderer will use texture fallbacks.', error)
  }
}
