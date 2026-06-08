'use client'

import { memo } from 'react'
import { ColonyPanel } from '@/components/game/ColonyPanel'
import { ResourcesBar } from './ResourcesBar'
import { EventsPanel } from '@/components/game/EventsPanel'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'

interface ColonyScreenProps {
  colony: Colony | null
  colonyLoading: boolean
  colonyId: string | null
  resources: ResourceRow[]
  resourcesLoading: boolean
  onLogout: () => void
  children?: React.ReactNode
}

export const ColonyScreen = memo(function ColonyScreen({
  colony,
  colonyLoading,
  colonyId,
  resources,
  resourcesLoading,
  onLogout,
  children,
}: ColonyScreenProps) {
  return (
    <div className="flex flex-col gap-3 p-3 pb-20 overflow-y-auto h-full">
      <div className="glass-panel rounded-xl p-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Mars2050</h1>
          <p className="text-xs text-gray-400">Колонизация Марса</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-gray-700"
        >
          Выйти
        </button>
      </div>

      <ColonyPanel colony={colony} loading={colonyLoading} />

      <ResourcesBar resources={resources} loading={resourcesLoading} />

      <div className="grid grid-cols-2 gap-2">
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs text-gray-400">Зданий</p>
          <p className="text-2xl font-bold text-white">{children ? '—' : '0'}</p>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs text-gray-400">Уровень</p>
          <p className="text-2xl font-bold text-mars-gold">{colony?.level || 1}</p>
        </div>
      </div>

      {colonyId && (
        <EventsPanel colonyId={colonyId} />
      )}
    </div>
  )
})
