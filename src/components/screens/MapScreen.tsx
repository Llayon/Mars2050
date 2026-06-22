'use client'

import { memo, useState } from 'react'
import { useMap, getExplorationCost } from '@/hooks/useMap'
import { ResourcesBar } from './ResourcesBar'
import { useToast } from '@/components/ui/toast'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { LOCATION_COLORS, LOCATION_LABELS } from '@/domains/map/map.config'
import type { MapLocation } from '@/domains/map/map.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { BattleReplayModal } from '@/components/game/BattleReplayModal'

interface MapScreenProps {
  colonyId: string
  resources: ResourceRow[]
  resourcesLoading: boolean
}

export const MapScreen = memo(function MapScreen({ colonyId, resources, resourcesLoading }: MapScreenProps) {
  const { locations, loading, discoverLocation } = useMap()
  const { toast } = useToast()
  const [selected, setSelected] = useState<MapLocation | null>(null)
  const [exploring, setExploring] = useState(false)
  const [replayData, setReplayData] = useState<Record<string, unknown> | null>(null)

  async function handleDiscover(locationId: string) {
    setExploring(true)
    try {
      const result = await discoverLocation(locationId, colonyId)
      toast(result.message || 'Локация исследована!', 'success')
      setSelected(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка исследования'
      toast(msg, 'error')
    } finally {
      setExploring(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-0">
        <ResourcesBar resources={resources} loading={resourcesLoading} />
      </div>

      <div className="flex-1 p-3 pb-24 overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-2">Карта Марса</h2>
        <p className="text-xs text-gray-400 mb-3">{locations.length} локаций</p>

        {loading ? (
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <div className="glass-panel rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">Карта пуста</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-8 gap-1.5">
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => setSelected(loc)}
                  className={`aspect-square rounded-lg border transition-all duration-200 flex items-center justify-center text-sm font-bold
                    ${loc.is_discovered
                      ? (LOCATION_COLORS[loc.type] || 'bg-mars-teal/40') + ' border-mars-border hover:scale-105'
                      : 'bg-black/40 border-gray-700/30 hover:border-mars-red/50'
                    }
                    ${selected?.id === loc.id ? 'ring-2 ring-mars-gold scale-105' : ''}
                  `}
                >
                  {loc.is_discovered ? (
                    <span className="text-lg">{loc.name.charAt(0)}</span>
                  ) : (
                    <span className="text-gray-600 text-lg">?</span>
                  )}
                </button>
              ))}
            </div>

            {selected && (
              <div className="mt-3 glass-panel rounded-xl p-4 animate-float-up">
                <h3 className="font-bold text-white">{selected.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {LOCATION_LABELS[selected.type] || selected.type} • Сложность: {'⭐'.repeat(selected.difficulty)}
                </p>
                {selected.is_discovered ? (
                  <div className="mt-2">
                    {selected.resources && typeof selected.resources === 'object' && ('_alien_nest' in selected.resources) && selected.resources['_cleared'] === 0 ? (
                      <div className="bg-red-900/40 p-3 rounded-lg border border-red-500/50 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🐛</span>
                          <span className="text-sm font-bold text-red-400">Вражеское гнездо!</span>
                        </div>
                        <p className="text-[10px] text-gray-300 mb-3">Зачистите территорию, чтобы получить доступ к ресурсам.</p>
                        <button
                          onClick={async () => {
                            if (exploring) return
                            setExploring(true)
                            try {
                              const res = await fetch('/api/map/attack', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ colonyId, locationId: selected.id })
                              })
                              const data = await res.json()
                              if (data.error) throw new Error(data.error.message || data.error)
                              
                              setReplayData({
                                attackerUnits: data.attackerUnits,
                                defenderUnits: data.defenderUnits,
                                logs: data.logs,
                                message: data.message
                              })
                              // Map automatically updates via Realtime
                            } catch (e: unknown) {
                              toast((e as Error).message, 'error')
                            } finally {
                              setExploring(false)
                            }
                          }}
                          disabled={exploring}
                          className="w-full bg-red-600 hover:bg-red-500 py-2 rounded text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {exploring ? 'Атака...' : '⚔️ Атаковать гнездо'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-green-400">✅ Исследовано</span>
                        {selected.resources && typeof selected.resources === 'object' && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(selected.resources).map(([k, v]) => {
                              if (k.startsWith('_')) return null
                              return (
                                <span key={k} className="text-[10px] bg-mars-teal/20 text-mars-teal px-2 py-0.5 rounded">
                                  {RESOURCE_NAMES[k] || k}: {String(v)}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-[10px] text-gray-500 mb-2">
                      Стоимость: {Object.entries(getExplorationCost(selected.difficulty)).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')}
                    </p>
                    <button
                      onClick={() => handleDiscover(selected.id)}
                      disabled={exploring}
                      className="w-full bg-mars-red hover:bg-red-700 disabled:opacity-50 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {exploring ? 'Исследование...' : '🔍 Исследовать'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {replayData && (
        <BattleReplayModal
          attackerUnits={replayData.attackerUnits}
          defenderUnits={replayData.defenderUnits}
          logs={replayData.logs}
          onClose={() => {
            if (replayData.message) toast(replayData.message, 'success')
            setReplayData(null)
          }}
        />
      )}
    </div>
  )
})
