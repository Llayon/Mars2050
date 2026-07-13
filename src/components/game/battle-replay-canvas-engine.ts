import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import { drawReplay } from './battle-replay-canvas-draw'
import type { BattleReplayEngineProps, ReplayAppHandle } from './battle-replay-canvas-types'
import { createBattleReplayRuntime } from './battle-replay-runtime'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls } from './battle-replay-canvas-types'

export async function startCanvasBattleReplayEngine(props: BattleReplayEngineProps) {
  const { container, obstacles } = props
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

  const runtime = createBattleReplayRuntime(props)
  let animationFrame = 0

  const renderLoop = (now: number) => {
    const frame = runtime.frame(now)
    drawReplay(ctx, dpr, frame.units, obstacles ?? [], frame.hazards, frame.projectiles, frame.texts, frame.overlays, frame.progress)
    animationFrame = requestAnimationFrame(renderLoop)
  }

  animationFrame = requestAnimationFrame(renderLoop)

  const cleanupEvents = () => {
    cancelAnimationFrame(animationFrame)
    canvas.remove()
  }
  const app: ReplayAppHandle = { canvas, destroy: cleanupEvents }
  return { app, cleanupEvents, controls: runtime.controls }
}

export const startBattleReplayEngine = startCanvasBattleReplayEngine
