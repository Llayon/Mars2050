'use client'

import { memo, useState } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { usePvp } from '@/hooks/usePvp'
import { useToast } from '@/components/ui/toast'
import { BattleReplayModal } from '@/components/game/BattleReplayModal'
import { ArmyPanel } from '@/components/game/ArmyPanel'
import { BattleHistoryPanel } from '@/components/game/BattleHistoryPanel'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { AttackResult } from '@/domains/pvp/pvp.types'

interface OperationsScreenProps {
  colonyId: string | null
  resources: ResourceRow[]
}

type OpsTab = 'events' | 'pvp' | 'army' | 'history'

export const OperationsScreen = memo(function OperationsScreen({ colonyId, resources }: OperationsScreenProps) {
  const [activeTab, setActiveTab] = useState<OpsTab>('events')
  const { events, loading: eventsLoading } = useEvents(colonyId)
  const { attack, attacking, error: pvpError } = usePvp(colonyId)
  const { toast } = useToast()

  const [targetId, setTargetId] = useState('')
  const [replayData, setReplayData] = useState<AttackResult | null>(null)

  async function handleAttack() {
    if (!targetId.trim() || !colonyId) return
    const result = await attack(targetId.trim())
    if (result?.message) toast(result.message, result.message.includes('успешна') ? 'success' : 'error')
    if (result?.logs && result?.attackerUnits) setReplayData(result)
  }

  const getEventEmoji = (type: string) => {
    const emojis: Record<string, string> = { dust_storm: '🌪️', meteor_shower: '☄️', anomaly_discovered: '🔬', resource_vein: '💎', cold_wave: '🥶', solar_flare: '☀️' }
    return emojis[type] || '📢'
  }

  const getTimeLeft = (endsAt: string | undefined) => {
    if (!endsAt) return null
    const msLeft = new Date(endsAt).getTime() - Date.now()
    if (msLeft <= 0) return 'Завершается...'
    return `${Math.ceil(msLeft / 60000)} мин.`
  }

  const hasProductionModifier = (effect: Record<string, unknown>): boolean => {
    return !!effect && typeof effect.production_modifier === 'object' && effect.production_modifier !== null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-0">
        <h2 className="text-lg font-bold text-white">Операции</h2>
      </div>

      <div className="flex gap-1 px-3 pt-2">
        {(['events', 'pvp', 'army', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'glass-panel text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'events' ? '⚠️ События' : tab === 'pvp' ? '⚔️ PvP' : tab === 'army' ? '🛡️ Армия' : '📜 Отчеты'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        {activeTab === 'history' && (
          <div className="mt-2">
            <BattleHistoryPanel colonyId={colonyId!} />
          </div>
        )}
        {activeTab === 'army' && (
          <div className="mt-2">
            <ArmyPanel colonyId={colonyId!} resources={resources} />
          </div>
        )}
        {activeTab === 'events' && (
          eventsLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-20 glass-panel rounded-xl animate-pulse" />)}
            </div>
          ) : !events || events.length === 0 ? (
            <div className="glass-panel rounded-xl p-6 text-center mt-2">
              <p className="text-gray-400 text-sm">Событий пока нет</p>
              <p className="text-xs text-gray-600 mt-1">События появляются случайно во время игры</p>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {events.map(event => (
                <div key={event.id} className="glass-panel rounded-xl p-3 border-l-2 border-yellow-600">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getEventEmoji(event.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{event.name}</p>
                      <p className="text-xs text-gray-400 truncate">{event.description}</p>
                    </div>
                    {event.ends_at && (
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{getTimeLeft(event.ends_at)}</span>
                    )}
                  </div>
                  {hasProductionModifier(event.effect) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {Object.entries(event.effect.production_modifier as Record<string, number>).map(([res, mod]) => (
                        <span key={res} className={`text-[10px] px-2 py-0.5 rounded-full ${
                          mod < 0 ? 'bg-red-900/40 text-red-300' : 'bg-green-900/40 text-green-300'
                        }`}>
                          {res}: {mod > 0 ? '+' : ''}{(mod * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'pvp' && (
          <div className="space-y-3 mt-2">
            {pvpError && (
              <div className="glass-panel rounded-xl p-3 border border-red-500/30">
                <p className="text-sm text-red-300">{pvpError}</p>
              </div>
            )}
            <div className="glass-panel rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-3">⚔️ Военная операция</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ID колонии цели</label>
                  <input
                    type="text"
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-mars-red"
                    placeholder="uuid цели"
                  />
                </div>
                <div>
                  <button
                    onClick={handleAttack}
                    disabled={attacking || !targetId.trim() || !colonyId}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {attacking ? 'Атака в процессе...' : 'Начать атаку всей армией'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits || []}
          defenderUnits={replayData.defenderUnits || []}
          initialState={replayData.initialState || []}
          logs={replayData.logs || []}
          obstacles={replayData.obstacles}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  )
})
