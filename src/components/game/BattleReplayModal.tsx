'use client'
import { useEffect, useRef, memo } from 'react'
import type { BattleTick, UnitRow, SimUnit } from '@/domains/combat/combat.types'
import { startBattleReplayEngine } from './battle-replay-engine'
import type { Application } from 'pixi.js'

export const BattleReplayModal = memo(function BattleReplayModal({ attackerUnits, defenderUnits, initialState, logs, onClose }: { attackerUnits: UnitRow[], defenderUnits: UnitRow[], initialState?: SimUnit[], logs: BattleTick[], onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

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
        logs
      })
      
      if (isDestroyed) {
        if (result.cleanupEvents) result.cleanupEvents()
        try { result.app.destroy(true) } catch(e) {}
        return
      }
      
      app = result.app
      cleanupEvents = result.cleanupEvents
    }

    initPixi()
    return () => { 
      isDestroyed = true
      if (app) {
        if (cleanupEvents) cleanupEvents()
        try { app.destroy(true) } catch(e) {}
      }
    }
  }, [attackerUnits, defenderUnits, initialState, logs])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
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
