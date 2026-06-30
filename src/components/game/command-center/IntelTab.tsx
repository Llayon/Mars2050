'use client'

import { BattleHistoryPanel } from '@/components/game/BattleHistoryPanel'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'

interface IntelTabProps {
  colonyId: string
  onReplay: (payload: BattleReplayPayload) => void
}

export function IntelTab({ colonyId, onReplay }: IntelTabProps) {
  return (
    <div className="h-full w-full bg-slate-900/40 p-4 lg:p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-cyan-500/20 pb-4 mb-6">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-mono mb-1">{'// Operational Intel'}</div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Combat Logs & Replays</h2>
          <p className="text-gray-400 text-sm mt-2">
            Review past engagements to analyze enemy formations and adjust your defensive grid.
          </p>
        </div>

        {/* 
          We reuse the existing BattleHistoryPanel.
          It expects a `colonyId` and an `onReplay` callback to trigger the replay modal. 
        */}
        <div className="bg-black/40 border border-cyan-500/10 p-4">
          <BattleHistoryPanel colonyId={colonyId} onReplay={onReplay} />
        </div>
      </div>
    </div>
  )
}
