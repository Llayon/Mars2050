'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow, BattleTick } from '@/domains/combat/combat.types'
import { BattleReplayModal } from './BattleReplayModal'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'

interface BattleHistoryPanelProps {
  colonyId: string
}

interface BattleRow {
  id: string
  attacker_colony_id: string
  defender_colony_id: string | null
  winner: string
  attacker_units: UnitRow[]
  defender_units: UnitRow[]
  rewards: Record<string, number>
  created_at: string
}

export function BattleHistoryPanel({ colonyId }: BattleHistoryPanelProps) {
  const [battles, setBattles] = useState<BattleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [replayData, setReplayData] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    async function loadBattles() {
      const { data } = await supabase
        .from('battles')
        .select('*')
        .or(`attacker_colony_id.eq.${colonyId},defender_colony_id.eq.${colonyId}`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) setBattles(data as BattleRow[])
      setLoading(false)
    }
    loadBattles()
  }, [colonyId])

  function handleReplay(battle: BattleRow) {
    // Reconstruct battle log deterministically
    const result = simulateBattle(battle.attacker_units as UnitRow[], battle.defender_units as UnitRow[])
    setReplayData({
      attackerUnits: battle.attacker_units,
      defenderUnits: battle.defender_units,
      logs: result.logs,
      message: `Победитель: ${battle.winner === 'attacker' ? 'Атакующий' : battle.winner === 'defender' ? 'Защитник' : 'Ничья'}`
    })
  }

  if (loading) return <div className="text-center py-4 text-gray-400">Загрузка...</div>

  if (battles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-gray-800/50 rounded-xl">
        Вы еще не участвовали в сражениях.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {battles.map(b => {
        const isAttacker = b.attacker_colony_id === colonyId
        const isPvE = !b.defender_colony_id
        
        let statusColor = 'text-gray-400'
        let statusText = 'Ничья'
        if (b.winner === 'attacker') {
          statusColor = isAttacker ? 'text-green-400' : 'text-red-400'
          statusText = isAttacker ? 'Победа (Атака)' : 'Поражение (Защита)'
        } else if (b.winner === 'defender') {
          statusColor = isAttacker ? 'text-red-400' : 'text-green-400'
          statusText = isAttacker ? 'Поражение (Атака)' : 'Победа (Защита)'
        }

        return (
          <div key={b.id} className="bg-gray-800 p-3 rounded-xl border border-gray-700">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className={`font-bold ${statusColor}`}>{statusText}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(b.created_at).toLocaleString('ru-RU')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {isPvE ? 'PvE: Гнездо пришельцев' : (isAttacker ? 'PvP: Атака на базу' : 'PvP: Защита базы')}
                </div>
              </div>
              <button 
                onClick={() => handleReplay(b)}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-xs font-medium transition-colors text-white"
              >
                ▶️ Реплей
              </button>
            </div>
            
            {b.rewards && Object.keys(b.rewards).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">
                  {isAttacker && b.winner === 'attacker' ? 'Захвачено:' : (!isAttacker && b.winner === 'attacker' ? 'Потеряно:' : 'Награда:')}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(b.rewards).map(([k, v]) => (
                    <span key={k} className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                      {RESOURCE_NAMES[k] || k}: {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits as UnitRow[]}
          defenderUnits={replayData.defenderUnits as UnitRow[]}
          logs={replayData.logs as BattleTick[]}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
}
