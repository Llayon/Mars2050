'use client'

import { memo, useState } from 'react'
import { usePvp } from '@/hooks/usePvp'

interface PvpPanelProps {
  colonyId: string | null
  onResult?: (msg: string) => void
}

export const PvpPanel = memo(function PvpPanel({ colonyId, onResult }: PvpPanelProps) {
  const { attack, trade, attacking, trading, error } = usePvp(colonyId)
  const [targetId, setTargetId] = useState('')
  const [units, setUnits] = useState(10)

  async function handleAttack() {
    if (!targetId.trim()) return
    const result = await attack(targetId.trim(), units)
    if (result?.message && onResult) onResult(result.message)
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
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-1">Юниты</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={units}
              onChange={e => setUnits(Number(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAttack}
              disabled={attacking || !targetId.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 px-4 py-1.5 rounded text-sm text-white"
            >
              {attacking ? '...' : '⚔️ Атака'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
