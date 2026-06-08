'use client'

import { memo, useState, useCallback } from 'react'
import { useMap, getExplorationCost } from '@/hooks/useMap'
import { useToast } from '@/components/ui/toast'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { LOCATION_COLORS, LOCATION_LABELS } from '@/domains/map/map.config'
import type { MapLocation } from '@/domains/map/map.types'

interface GameMapPanelProps {
  colonyId: string
}

export const GameMapPanel = memo(function GameMapPanel({ colonyId }: GameMapPanelProps) {
  const { locations, loading, discoverLocation } = useMap()
  const { toast } = useToast()
  const [selected, setSelected] = useState<MapLocation | null>(null)

  async function handleDiscover(locationId: string) {
    try {
      const result = await discoverLocation(locationId, colonyId)
      toast(result.message || 'Локация исследована!', 'success')
    } catch (e: any) {
      toast(e.message || 'Ошибка исследования', 'error')
    }
  }

  if (loading) return <p className="text-white">Загрузка карты...</p>

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-white">Карта Марса ({locations.length} локаций)</h2>
      {locations.length === 0 ? (
        <p className="text-gray-400">Карта пуста</p>
      ) : (
        <>
          <div className="grid grid-cols-10 gap-1 mb-4 max-h-96 overflow-y-auto">
            {locations.map(loc => (
              <div
                key={loc.id}
                onClick={() => setSelected(loc)}
                className={`w-12 h-12 rounded border-2 cursor-pointer flex items-center justify-center text-xs
                  ${loc.is_discovered ? (LOCATION_COLORS[loc.type] || 'bg-gray-500') : 'bg-gray-800'}
                  border-gray-700 hover:border-yellow-400 transition-colors`}
                title={loc.name}
              >
                {loc.is_discovered ? loc.name.charAt(0) : '?'}
              </div>
            ))}
          </div>

          {selected && (
            <LocationDetail
              location={selected}
              onDiscover={handleDiscover}
            />
          )}
        </>
      )}
    </div>
  )
})

function LocationDetail({ location, onDiscover }: { location: MapLocation; onDiscover: (id: string) => void }) {
  const cost = getExplorationCost(location.difficulty)

  return (
    <div className="bg-gray-800 p-4 rounded-md mt-4 text-white">
      <h3 className="text-lg font-semibold">{location.name}</h3>
      <p className="text-sm text-gray-300">Тип: {LOCATION_LABELS[location.type] || location.type}</p>
      <p className="text-sm text-gray-300">Сложность: {'⭐'.repeat(location.difficulty)}</p>

      {location.is_discovered ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-green-400">✅ Исследовано</p>
          {location.resources && typeof location.resources === 'object' && (
            <div className="mt-1">
              <p className="text-sm font-semibold">Ресурсы:</p>
              {Object.entries(location.resources).map(([key, value]) => (
                <p key={key} className="text-xs text-gray-400">{RESOURCE_NAMES[key] || key}: {String(value)}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-2">
            Стоимость: {Object.entries(cost).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')}
          </p>
          <button
            onClick={() => onDiscover(location.id)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
          >
            Исследовать
          </button>
        </div>
      )}
    </div>
  )
}