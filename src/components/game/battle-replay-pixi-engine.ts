import { Application, Assets, Container } from 'pixi.js'
import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { BattleReplayEngineProps, ReplayAppHandle } from './battle-replay-canvas-types'
import { createBattleReplayRuntime } from './battle-replay-runtime'
import { drawPixiReplay } from './battle-replay-pixi-draw'
import { createPixiReplayScene } from './battle-replay-pixi-scene'
import { resolveReplaySprite } from './battle-replay-sprites'
import { SPRITE_DIRS } from './battle-replay-visual-registry'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls } from './battle-replay-canvas-types'

export async function startPixiBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, logs, obstacles } = props
  const runtime = createBattleReplayRuntime(props)
  await preloadReplayAssets(Object.values(runtime.snapshot().units).map(unit => unit.type), logs)

  const app = new Application()
  await app.init({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    backgroundColor: 0x1a1a2e,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  app.canvas.style.width = '100%'
  app.canvas.style.height = '100%'
  app.canvas.style.display = 'block'
  app.canvas.style.objectFit = 'contain'
  app.canvas.style.background = '#1a1a2e'
  container.appendChild(app.canvas)

  const root = new Container()
  root.sortableChildren = true
  app.stage.addChild(root)
  const scene = createPixiReplayScene(root, obstacles ?? [])

  const renderLoop = () => {
    const frame = runtime.frame(performance.now())
    drawPixiReplay(scene, frame)
  }
  app.ticker.add(renderLoop)
  renderLoop()

  const cleanupEvents = () => {
    app.ticker.remove(renderLoop)
    try { app.destroy(true, { children: true, texture: false, textureSource: false }) } catch {}
  }
  const replayApp: ReplayAppHandle = { canvas: app.canvas, destroy: cleanupEvents }
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
