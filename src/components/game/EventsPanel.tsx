'use client'

import { memo } from 'react'
import { useEvents } from '@/hooks/useEvents'

interface EventsPanelProps {
  colonyId: string | null
  onCreateTest?: (colonyId: string, type: string, duration: number) => Promise<boolean>
}

export const EventsPanel = memo(function EventsPanel({ colonyId, onCreateTest }: EventsPanelProps) {
  const { events, loading, error } = useEvents(colonyId)

  if (loading) return <div className="p-4 text-gray-400">Загрузка событий...</div>
  if (error) return <div className="p-4 text-red-400">Ошибка: {error}</div>
  if (!events || events.length === 0) return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-3">⚠️ События</h3>
      <p className="text-gray-400 text-sm mb-2">Событий пока нет</p>
      {onCreateTest && (
        <button
          onClick={() => onCreateTest(colonyId || '', 'dust_storm', 5)}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm text-white"
        >
          + Тест: Пылевая буря (5 мин)
        </button>
      )}
    </div>
  )

  const getEventEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      dust_storm: '🌪️',
      meteor_shower: '☄️',
      anomaly_discovered: '🔬',
      resource_vein: '💎',
      cold_wave: '🥶',
      solar_flare: '☀️',
    }
    return emojis[type] || '📢'
  }

  const getTimeLeft = (endsAt: string | undefined) => {
    if (!endsAt) return null
    const msLeft = new Date(endsAt).getTime() - Date.now()
    if (msLeft <= 0) return 'Завершается...'
    const minutes = Math.ceil(msLeft / 60000)
    return `${minutes} мин.`
  }

  const hasProductionModifier = (effect: Record<string, unknown>): boolean => {
    return !!effect && typeof effect.production_modifier === 'object' && effect.production_modifier !== null
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-white">⚠️ События</h3>
        {onCreateTest && (
          <button
            onClick={() => onCreateTest(colonyId || '', 'dust_storm', 5)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm text-white"
          >
            + Тест
          </button>
        )}
      </div>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-gray-900 rounded p-3 border border-yellow-700"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getEventEmoji(event.type)}</span>
                  <h4 className="font-semibold text-white">{event.name}</h4>
                </div>
                <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                {hasProductionModifier(event.effect) && (
                  <div className="mt-2 text-xs">
                    {Object.entries(event.effect.production_modifier as Record<string, number>).map(
                      ([resource, modifier]) => (
                        <span
                          key={resource}
                          className={`inline-block px-2 py-1 rounded mr-1 ${
                            modifier < 0 ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'
                          }`}
                        >
                          {resource}: {modifier > 0 ? '+' : ''}{(modifier * 100).toFixed(0)}%
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
              {event.ends_at && (
                <div className="text-xs text-gray-500 ml-2">
                  {getTimeLeft(event.ends_at)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
