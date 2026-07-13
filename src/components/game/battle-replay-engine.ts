import type { BattleReplayEngineProps, ReplayRendererMode } from './battle-replay-canvas-types'

export type { BattleReplayEngineProps, ReplayAppHandle, ReplayControls, ReplayRendererMode } from './battle-replay-canvas-types'

const REPLAY_RENDERER_STORAGE_KEY = 'mars2050:replay-renderer'

export async function startBattleReplayEngine(props: BattleReplayEngineProps) {
  const mode = resolveReplayRendererMode(props.rendererMode)
  if (mode === 'pixi') {
    try {
      const { startPixiBattleReplayEngine } = await import('./battle-replay-pixi-engine')
      return await startPixiBattleReplayEngine(props)
    } catch (error) {
      console.warn('Pixi replay renderer failed; falling back to canvas.', error)
    }
  }

  const { startCanvasBattleReplayEngine } = await import('./battle-replay-canvas-engine')
  return startCanvasBattleReplayEngine(props)
}

export function resolveReplayRendererMode(requested?: ReplayRendererMode): ReplayRendererMode {
  if (requested) return requested
  if (typeof window === 'undefined') return 'canvas'
  return window.localStorage.getItem(REPLAY_RENDERER_STORAGE_KEY) === 'pixi' ? 'pixi' : 'canvas'
}
