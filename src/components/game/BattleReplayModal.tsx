'use client'
import { useEffect, useRef, memo, useState, useMemo } from 'react'
import type { BattleTick, UnitRow, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import { startBattleReplayEngine } from './battle-replay-engine'
import type { ReplayControls } from './battle-replay-engine'
import type { Application } from 'pixi.js'
import { getSizeRadius } from '@/domains/combat/combat.utils'

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, initialState, logs, obstacles, onClose }: { attackerUnits: UnitRow[], defenderUnits: UnitRow[], initialState?: SimUnit[], logs: BattleTick[], obstacles?: Obstacle[], onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<ReplayControls | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [overlays, setOverlays] = useState({ radius: false, velocity: false, targets: false })

  const metrics = useMemo(() => {
    const totalTicks = logs.length
    let firstAttack = -1
    for(const log of logs) {
      if(log.actions.some(a => a.type === 'attack')) {
        firstAttack = log.tick; break;
      }
    }

    let totalOverlap = 0
    let overlapPairs = 0
    let maxOverlap = 0

    if (initialState) {
      const units = new Map<string, {x: number, y: number, isDead: boolean, size: SimUnit['size'], isFlying: boolean}>()
      initialState.forEach(u => units.set(u.id, { x: u.x, y: u.y, isDead: u.isDead, size: u.size, isFlying: u.isFlying }))

      const limit = Math.min(20, logs.length)
      for (let i = 0; i < limit; i++) {
         const log = logs[i]
         log.actions.forEach(a => {
           const u = units.get(a.unitId)
           if (!u) return
           if (a.type === 'move' && a.toX !== undefined && a.toY !== undefined) { u.x = a.toX; u.y = a.toY }
           if (a.type === 'die') u.isDead = true
         })
      }

      const alive = Array.from(units.values()).filter(u => !u.isDead)
      for(let i=0; i<alive.length; i++) {
        for(let j=i+1; j<alive.length; j++) {
          const u1 = alive[i], u2 = alive[j]
          if (u1.isFlying !== u2.isFlying) continue
          const dist = Math.hypot(u1.x - u2.x, u1.y - u2.y)
          const minDist = (getSizeRadius(u1.size) + getSizeRadius(u2.size)) * 0.95
          const overlap = Math.max(0, minDist - dist)
          if (overlap > 0) {
            totalOverlap += overlap; maxOverlap = Math.max(maxOverlap, overlap); overlapPairs++
          }
        }
      }
    }
    return { totalTicks, firstAttack, avgOverlap: overlapPairs > 0 ? (totalOverlap/overlapPairs).toFixed(1) : 0, maxOverlap: maxOverlap.toFixed(1) }
  }, [logs, initialState])

  useEffect(() => {
    let app: Application, isDestroyed = false
    let cleanupEvents: (() => void) | null = null

    async function initPixi() {
      if (!containerRef.current) return

      const result = await startBattleReplayEngine({
        container: containerRef.current,
        attackerUnits,
        defenderUnits,
        initialState,
        logs,
        obstacles
      })

      if (isDestroyed) {
        if (result.cleanupEvents) result.cleanupEvents()
        try { result.app.destroy(true) } catch(e) {}
        return
      }

      app = result.app
      cleanupEvents = result.cleanupEvents
      controlsRef.current = result.controls

      if (controlsRef.current) {
         controlsRef.current.setSpeed(speed)
         controlsRef.current.setOverlays(overlays)
         if (!isPlaying) controlsRef.current.pause()
      }
    }

    initPixi()
    return () => {
      isDestroyed = true
      if (app) {
        if (cleanupEvents) cleanupEvents()
        try { app.destroy(true) } catch(e) {}
      }
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
      <div className="absolute top-4 left-4 z-[60] flex flex-col gap-2">
        <div className="bg-gray-800/80 border border-gray-600 rounded-lg p-3 text-sm flex flex-col gap-2 shadow-lg w-64 backdrop-blur-md">
          <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 mb-1">Метрики (Tick {metrics.totalTicks})</div>
          <div className="flex justify-between text-gray-300"><span>Первая атака:</span> <span>{metrics.firstAttack >= 0 ? `Tick ${metrics.firstAttack}` : 'Нет'}</span></div>
          <div className="flex justify-between text-gray-300"><span>Avg Overlap (t=20):</span> <span>{metrics.avgOverlap}px</span></div>
          <div className="flex justify-between text-gray-300"><span>Max Overlap (t=20):</span> <span>{metrics.maxOverlap}px</span></div>
        </div>

        <div className="bg-gray-800/80 border border-gray-600 rounded-lg p-3 text-sm flex flex-col gap-3 shadow-lg w-64 backdrop-blur-md">
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
        className="absolute top-4 right-4 z-[60] w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-red-600 rounded-full text-white font-bold text-xl shadow-lg transition-colors border border-gray-600"
      >
        ✕
      </button>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-4">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]" style={{ height: '100%', maxHeight: '100%', aspectRatio: '1/2' }} />
      </div>
    </div>
  )
})
