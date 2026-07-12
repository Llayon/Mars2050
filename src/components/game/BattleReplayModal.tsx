'use client'
import { useEffect, useRef, memo, useState, useMemo } from 'react'
import type { BattleTick, UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import { startBattleReplayEngine } from './battle-replay-engine'
import type { ReplayControls } from './battle-replay-engine'
import { buildBattleReplayMetrics } from './battle-replay-metrics'

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, initialState, logs, obstacles, onClose }: { attackerUnits: UnitRow[], defenderUnits: UnitRow[], initialState?: SimUnit[], logs: BattleTick[], obstacles?: Obstacle[], onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<ReplayControls | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [currentTick, setCurrentTick] = useState(0)
  const [overlays, setOverlays] = useState({ radius: false, velocity: false, targets: false })

  const metrics = useMemo(() => buildBattleReplayMetrics(logs, initialState), [logs, initialState])
  const formatMetric = (value: number, digits: number) => value.toFixed(digits)

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
         if (!isPlaying) controlsRef.current.pause()
      }
    }

    initReplay()
    return () => {
      isDestroyed = true
      if (cleanupEvents) cleanupEvents()
    }
  }, [attackerUnits, defenderUnits, initialState, logs, obstacles])

  useEffect(() => {
    if (!controlsRef.current) return
    if (isPlaying) controlsRef.current.play()
    else controlsRef.current.pause()
  }, [isPlaying])

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
    setCurrentTick(clampedTick)
    setIsPlaying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
      <div className="absolute top-2 left-2 z-[60] flex flex-col gap-2 sm:top-4 sm:left-4">
        <div className="bg-gray-800/80 border border-gray-600 rounded-lg p-2 text-xs flex flex-col gap-2 shadow-lg w-56 backdrop-blur-md sm:w-64 sm:p-3 sm:text-sm">
          <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 mb-1">Метрики (Tick {metrics.totalTicks})</div>
          <div className="flex justify-between text-gray-300"><span>Первая атака:</span> <span>{metrics.firstAttack >= 0 ? `Tick ${metrics.firstAttack}` : 'Нет'}</span></div>
          <div className="flex justify-between text-gray-300"><span>Avg Overlap:</span> <span>{formatMetric(metrics.averageOverlap, 1)}px</span></div>
          <div className="flex justify-between text-gray-300"><span>Max Overlap:</span> <span>{formatMetric(metrics.maxOverlap, 1)}px</span></div>
          <div className="flex justify-between text-gray-300"><span>Avg Ratio:</span> <span>{formatMetric(metrics.averageOverlapRatio, 2)}</span></div>
          <div className="flex justify-between text-gray-300"><span>Max Ratio:</span> <span>{formatMetric(metrics.maxOverlapRatio, 2)}</span></div>
          <div className="flex justify-between text-gray-300"><span>Severe Samples:</span> <span>{metrics.severeOverlapSamples}/{metrics.overlapSamples}</span></div>
        </div>

        <div className="bg-gray-800/80 border border-gray-600 rounded-lg p-2 text-xs flex flex-col gap-2 shadow-lg w-56 backdrop-blur-md sm:w-64 sm:p-3 sm:text-sm sm:gap-3">
          <div className="font-bold text-gray-200 border-b border-gray-700 pb-1">Управление</div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsPlaying(!isPlaying)} className="flex-1 bg-blue-600 hover:bg-blue-500 rounded py-1 font-bold transition-colors">
              {isPlaying ? '⏸ Пауза' : '▶ Играть'}
            </button>
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
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-[60] w-9 h-9 flex items-center justify-center bg-gray-800/80 hover:bg-red-600 rounded-full text-white font-bold text-xl shadow-lg transition-colors border border-gray-600 sm:top-4 sm:right-4 sm:w-10 sm:h-10"
      >
        ✕
      </button>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-0 sm:p-4">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]" style={{ height: 'min(100%, 200vw)', maxHeight: '100%', maxWidth: '100%', aspectRatio: '1/2' }} />
      </div>
    </div>
  )
})
