'use client'

import { memo, useState } from 'react'
import { usePvp } from '@/hooks/usePvp'
import { BattleReplayModal } from './BattleReplayModal'

interface PvpPanelProps {
  colonyId: string | null
  onResult?: (msg: string) => void
}

export const PvpPanel = memo(function PvpPanel({ colonyId, onResult }: PvpPanelProps) {
  const { attack, trade, attacking, trading, error } = usePvp(colonyId)
  const [targetId, setTargetId] = useState('')
  const [replayData, setReplayData] = useState<any>(null)

  async function handleAttack() {
    if (!targetId.trim()) return
    const result = await attack(targetId.trim())
    if (result?.message && onResult) onResult(result.message)
    if (result?.logs && result?.attackerUnits) {
      setReplayData(result)
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-3 text-white">⚔️ PvP</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded text-sm mb-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">ID колонии цели</label>
          <input
            type="text"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
            placeholder="uuid цели"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAttack}
            disabled={attacking || !targetId.trim()}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm text-white"
          >
            {attacking ? 'Атака в процессе...' : '⚔️ Начать атаку всей армией'}
          </button>
        </div>
      </div>
      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits}
          defenderUnits={replayData.defenderUnits}
          logs={replayData.logs}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
})
