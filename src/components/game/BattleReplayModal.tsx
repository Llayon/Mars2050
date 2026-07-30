'use client'
import { useEffect, useRef, memo, useState, useMemo } from 'react'
import type { BattleTick, UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import { startBattleReplayEngine } from './battle-replay-engine'
import type { ReplayControls, ReplayRendererMode } from './battle-replay-engine'
import {
  buildBattleReplayMetrics,
  shouldCollectInlineReplayOverlapMetrics,
} from './battle-replay-metrics'

interface BattleReplayModalProps {
  attackerUnits: UnitRow[]
  defenderUnits: UnitRow[]
  initialState?: SimUnit[]
  logs: BattleTick[]
  obstacles?: Obstacle[]
  rendererMode?: ReplayRendererMode
  replayWarning?: string
  onClose: () => void
}

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, initialState, logs, obstacles, rendererMode, replayWarning, onClose }: BattleReplayModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<ReplayControls | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const isPlayingRef = useRef(true)
  const [speed, setSpeed] = useState(1)
  const [currentTick, setCurrentTick] = useState(0)
  const [showDesktopDebug, setShowDesktopDebug] = useState(false)
  const [overlays, setOverlays] = useState({ radius: false, velocity: false, targets: false })

  const collectOverlapMetrics = showDesktopDebug && shouldCollectInlineReplayOverlapMetrics(
    logs.length,
    initialState?.length ?? 0,
  )
  const metrics = useMemo(
    () => buildBattleReplayMetrics(
      logs,
      collectOverlapMetrics ? initialState : undefined,
    ),
    [collectOverlapMetrics, logs, initialState],
  )
  const formatMetric = (value: number, digits: number) => value.toFixed(digits)

  useEffect(() => {
    const media = window.matchMedia?.(
      '(min-width: 1024px) and (hover: hover) and (pointer: fine)',
    )
    if (!media) return
    const syncDebugVisibility = () => {
      setShowDesktopDebug(media.matches && navigator.maxTouchPoints === 0)
    }
    syncDebugVisibility()
    media.addEventListener('change', syncDebugVisibility)
    return () => media.removeEventListener('change', syncDebugVisibility)
  }, [])

  useEffect(() => {
    if (showDesktopDebug) return
    setOverlays(current => current.radius || current.velocity || current.targets
      ? { radius: false, velocity: false, targets: false }
      : current)
  }, [showDesktopDebug])

  useEffect(() => {
    let isDestroyed = false
    let cleanupEvents: (() => void) | null = null

    async function initReplay() {
      if (!containerRef.current) return

      const result = await startBattleReplayEngine({
        container: containerRef.current,
        attackerUnits,
        defenderUnits,
        initialState,
        logs,
        obstacles,
        rendererMode,
        onTickChange: setCurrentTick
      })

      if (isDestroyed) {
        if (result.cleanupEvents) result.cleanupEvents()
        return
      }

      cleanupEvents = result.cleanupEvents
      controlsRef.current = result.controls

      if (controlsRef.current) {
         controlsRef.current.setSpeed(speed)
         controlsRef.current.setOverlays(overlays)
         setCurrentTick(controlsRef.current.getCurrentTick())
         if (!isPlayingRef.current) controlsRef.current.pause()
      }
    }

    initReplay()
    return () => {
      isDestroyed = true
      if (cleanupEvents) cleanupEvents()
    }
  }, [attackerUnits, defenderUnits, initialState, logs, obstacles, rendererMode])

  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.setOverlays(overlays)
  }, [overlays])

  const handleTimelineChange = (nextTick: number) => {
    const clampedTick = Math.max(0, Math.min(metrics.totalTicks, Math.round(nextTick)))
    controlsRef.current?.pause()
    controlsRef.current?.seekToTick(clampedTick)
    isPlayingRef.current = false
    setCurrentTick(clampedTick)
    setIsPlaying(false)
  }

  const handlePlaybackToggle = () => {
    const nextIsPlaying = !isPlayingRef.current
    isPlayingRef.current = nextIsPlaying
    if (nextIsPlaying) controlsRef.current?.play()
    else controlsRef.current?.pause()
    setIsPlaying(nextIsPlaying)
  }

  const handleStepTick = () => {
    if (!controlsRef.current) return
    isPlayingRef.current = false
    controlsRef.current.stepTick()
    setCurrentTick(controlsRef.current.getCurrentTick())
    setIsPlaying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className={showDesktopDebug
        ? 'absolute top-4 left-4 z-[60] flex w-64 flex-col gap-2'
        : `absolute inset-x-2 z-[60] flex flex-col gap-2 ${replayWarning ? 'bottom-14' : 'bottom-2'}`}
      >
        {showDesktopDebug && (
          <div className="w-64 border border-gray-600 bg-gray-800/95 p-3 text-sm shadow-lg flex flex-col gap-2 rounded-lg">
            <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 mb-1">Метрики (Tick {metrics.totalTicks})</div>
            <div className="flex justify-between text-gray-300"><span>Первая атака:</span> <span>{metrics.firstAttack >= 0 ? `Tick ${metrics.firstAttack}` : 'Нет'}</span></div>
            {collectOverlapMetrics && (
              <>
                <div className="flex justify-between text-gray-300"><span>Avg Overlap:</span> <span>{formatMetric(metrics.averageOverlap, 1)}px</span></div>
                <div className="flex justify-between text-gray-300"><span>Max Overlap:</span> <span>{formatMetric(metrics.maxOverlap, 1)}px</span></div>
                <div className="flex justify-between text-gray-300"><span>Avg Ratio:</span> <span>{formatMetric(metrics.averageOverlapRatio, 2)}</span></div>
                <div className="flex justify-between text-gray-300"><span>Max Ratio:</span> <span>{formatMetric(metrics.maxOverlapRatio, 2)}</span></div>
                <div className="flex justify-between text-gray-300"><span>Severe Samples:</span> <span>{metrics.severeOverlapSamples}/{metrics.overlapSamples}</span></div>
              </>
            )}
          </div>
        )}

        <div
          data-testid="replay-controls"
          className={showDesktopDebug
            ? 'flex w-full flex-col gap-3 rounded-lg border border-gray-600 bg-gray-800/95 p-3 text-sm shadow-lg'
            : 'flex w-full flex-col gap-2 border-t border-white/15 bg-black/70 px-2 py-2 text-xs shadow-lg'}
        >
          {showDesktopDebug && (
            <div className="border-b border-gray-700 pb-1 font-bold text-gray-200">Управление</div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={handlePlaybackToggle} className="flex-1 bg-blue-600 hover:bg-blue-500 rounded py-1 font-bold transition-colors">
              {isPlaying ? '⏸ Пауза' : '▶ Играть'}
            </button>
            {showDesktopDebug && (
              <button type="button" aria-label="Следующий тик" title="Следующий тик"
                onClick={handleStepTick} className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-700 text-base hover:bg-gray-600">
                ⏭
              </button>
            )}
            <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-gray-700 rounded px-2 py-1 outline-none text-white w-20">
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={2}>2.0x</option>
              <option value={4}>4.0x</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-gray-300">
              <span className="font-bold text-gray-200">Таймлайн</span>
              <span data-testid="replay-current-tick" className="tabular-nums">Tick {currentTick} / {metrics.totalTicks}</span>
            </div>
            <input
              data-testid="replay-timeline"
              aria-label="Таймлайн реплея"
              type="range"
              min={0}
              max={Math.max(0, metrics.totalTicks)}
              step={1}
              value={Math.min(currentTick, metrics.totalTicks)}
              onChange={e => handleTimelineChange(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {showDesktopDebug && (
            <>
              <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 mt-1">Оверлеи (Debug)</div>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white text-gray-300">
                <input type="checkbox" checked={overlays.radius} onChange={e => setOverlays({...overlays, radius: e.target.checked})} />
                Хитбоксы (Радиус)
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white text-gray-300">
                <input type="checkbox" checked={overlays.velocity} onChange={e => setOverlays({...overlays, velocity: e.target.checked})} />
                Векторы движения
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white text-gray-300">
                <input type="checkbox" checked={overlays.targets} onChange={e => setOverlays({...overlays, targets: e.target.checked})} />
                Линии атак (Снаряды)
              </label>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-[60] w-9 h-9 flex items-center justify-center bg-gray-800/80 hover:bg-red-600 rounded-full text-white font-bold text-xl shadow-lg transition-colors border border-gray-600 sm:top-4 sm:right-4 sm:w-10 sm:h-10"
      >
        ✕
      </button>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-0 sm:p-4">
        <div className="flex-1 min-h-0 flex w-full items-center justify-center">
          <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]" style={{ height: 'min(100%, 200vw)', maxHeight: '100%', maxWidth: '100%', aspectRatio: '1/2' }} />
        </div>
        {replayWarning && (
          <div role="status" className="w-full shrink-0 border-t border-amber-500/60 bg-amber-950/90 px-4 py-2 text-center text-xs text-amber-100">
            {replayWarning}
          </div>
        )}
      </div>
    </div>
  )
})
