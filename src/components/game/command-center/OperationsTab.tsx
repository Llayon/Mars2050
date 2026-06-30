'use client'

import { useState } from 'react'
import { usePvp } from '@/hooks/usePvp'
import { useCombat } from '@/hooks/useCombat'
import { DeploymentPlanner } from '@/components/game/DeploymentBoard'
import type { DeploymentPoint } from '@/domains/combat/combat.deployment'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'

export function OperationsTab({ colonyId, onReplay }: { colonyId: string, onReplay: (payload: BattleReplayPayload) => void }) {
  const { attack, attacking, error, cooldownRemaining } = usePvp(colonyId)
  const { units, isLoading } = useCombat(colonyId)

  const [targetId, setTargetId] = useState('')

  if (isLoading) {
    return <div className="p-12 text-center text-cyan-500 animate-pulse font-mono uppercase tracking-widest">Initializing Strike Systems...</div>
  }

  // Filter out destroyed units
  const availableUnits = units.filter(u => u.hp_current > 0)

  const handleAttack = async (placement: DeploymentPoint[]) => {
    const result = await attack(targetId.trim(), placement)
    if (result && result.success) {
      onReplay({
        attackerUnits: result.attackerUnits || [],
        defenderUnits: result.defenderUnits || [],
        initialState: result.initialState || [],
        logs: result.logs || [],
        obstacles: result.obstacles || [],
        message: result.message || 'Атака завершена'
      })
    }
  }

  return (
    <div className="h-full w-full flex flex-col font-mono text-white">

      {/* Target Acquisition Header */}
      <div className="bg-slate-900 border-b border-cyan-500/20 p-4 shrink-0 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
        <div className="flex-1 w-full flex flex-col gap-2">
          <div className="text-xs uppercase tracking-widest text-gray-500">{'// Target Acquisition'}</div>
          <input 
            type="text" 
            placeholder="Enter Target UUID..." 
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-black/60 border border-cyan-500/30 text-cyan-300 placeholder:text-cyan-900/50 px-4 py-2 text-sm focus:outline-none focus:border-cyan-400 focus:bg-cyan-950/20 transition-colors"
          />
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="text-xs text-gray-500 uppercase tracking-widest flex items-center mr-2">Practice:</span>
            <button onClick={() => setTargetId('npc_outpost')} className="bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-200 transition-colors">NPC Outpost</button>
            <button onClick={() => setTargetId('npc_raider')} className="bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-200 transition-colors">Raider Camp</button>
            <button onClick={() => setTargetId('npc_heavy')} className="bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-200 transition-colors">Heavy Def</button>
            <button onClick={() => setTargetId('npc_air')} className="bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-200 transition-colors">Air Def</button>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2 lg:pl-6 lg:border-l border-cyan-500/20">
          <div className="text-xs uppercase tracking-widest text-gray-500">{'// Status'}</div>
          <div className="flex justify-between items-center bg-black/40 px-4 py-2 border border-white/5">
            <span className="text-sm">Target: <span className={targetId ? 'text-cyan-400' : 'text-gray-500'}>{targetId ? 'LOCK' : 'UNKNOWN'}</span></span>
            <span className="text-sm">
              Cooldown: <span className={cooldownRemaining > 0 ? 'text-amber-400' : 'text-green-400'}>
                {cooldownRemaining > 0 ? `${cooldownRemaining}s` : 'READY'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950/50 border-b border-red-500/30 text-red-300 p-2 text-sm text-center">
          [ SYSTEM ERROR ]: {error}
        </div>
      )}

      {/* Deployment Planner */}
      <div className="flex-1 relative overflow-y-auto min-h-0">
        <DeploymentPlanner
          mode="attack"
          units={availableUnits}
          saveLabel="НАЧАТЬ АТАКУ"
          onSave={handleAttack}
        />

        {/* Overlay Block if Attacking or on Cooldown */}
        {(attacking || cooldownRemaining > 0 || !targetId) && (
          <div
            className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center cursor-not-allowed"
            onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onPointerDownCapture={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            {!targetId && (
              <div className="bg-black/80 px-6 py-4 border border-cyan-500/30 text-cyan-500/80 uppercase tracking-widest backdrop-blur-sm">
                Enter Target UUID to unlock strike controls
              </div>
            )}
            {targetId && cooldownRemaining > 0 && (
              <div className="bg-black/80 px-6 py-4 border border-amber-500/30 text-amber-500/80 uppercase tracking-widest backdrop-blur-sm">
                Weapons on Cooldown ({cooldownRemaining}s)
              </div>
            )}
            {targetId && cooldownRemaining === 0 && attacking && (
              <div className="bg-red-950/80 px-6 py-4 border border-red-500 border-dashed text-red-500 uppercase tracking-widest backdrop-blur-sm animate-pulse">
                Initiating Assault...
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
