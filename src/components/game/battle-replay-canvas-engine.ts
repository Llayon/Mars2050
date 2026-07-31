import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import { drawReplay } from './battle-replay-canvas-draw'
import type { BattleReplayEngineProps, ReplayAppHandle } from './battle-replay-canvas-types'
import { getBrowserReplayRenderBudget } from './battle-replay-quality'
import { createBattleReplayRuntime } from './battle-replay-runtime'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls } from './battle-replay-canvas-types'

export async function startCanvasBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, obstacles } = props
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is unavailable')

  const runtime = createBattleReplayRuntime(props)
  const renderBudget = getBrowserReplayRenderBudget(
    runtime.snapshot().unitList.length,
  )
  const dpr = renderBudget.resolution
  canvas.width = Math.round(FIELD_WIDTH * dpr)
  canvas.height = Math.round(FIELD_HEIGHT * dpr)
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.objectFit = 'contain'
  canvas.style.background = '#1a1a2e'
  canvas.dataset.replayRenderer = 'canvas'
  container.appendChild(canvas)

  let animationFrame = 0
  let lastRender = Number.NEGATIVE_INFINITY
  const frameInterval = 1000 / renderBudget.maxFps

  const renderLoop = (now: number) => {
    if (now - lastRender >= frameInterval) {
      const frame = runtime.frame(now)
      drawReplay(ctx, dpr, frame, obstacles ?? [], renderBudget)
      lastRender = now
    }
    animationFrame = requestAnimationFrame(renderLoop)
  }

  animationFrame = requestAnimationFrame(renderLoop)

  const cleanupEvents = () => {
    cancelAnimationFrame(animationFrame)
    canvas.remove()
  }
  const app: ReplayAppHandle = {
    canvas,
    destroy: cleanupEvents,
    getPerformanceProfile: () => null,
  }
  return { app, cleanupEvents, controls: runtime.controls }
}

export const startBattleReplayEngine = startCanvasBattleReplayEngine
