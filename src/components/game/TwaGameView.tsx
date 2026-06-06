'use client'

import { memo, useState } from 'react'
import { GameTabs } from './GameTabs'
import { ColonyPanel } from './ColonyPanel'
import { ResourcePanel } from './ResourcePanel'
import { GameMapPanel } from './GameMapPanel'
import { BuildingsPanel } from './BuildingsPanel'
import { EventsPanel } from './EventsPanel'
import { PvpPanel } from './PvpPanel'
import { LeaderboardPanel } from './LeaderboardPanel'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { Colony } from '@/domains/colony/colony.types'
import type { BuildingTypeKey, BuildingRow } from '@/domains/building/building.types'

interface TwaGameViewProps {
  colony: Colony | null
  colonyLoading: boolean
  colonyId: string
  resources: ResourceRow[]
  resourcesLoading: boolean
  userEmail?: string
  buildings: BuildingRow[]
  onBuild: (type: BuildingTypeKey) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onRefresh: () => void
  onLogout: () => void
  onCreateEvent: (id: string, type: string, dur: number) => Promise<boolean>
  onToast: (msg: string) => void
}

export const TwaGameView = memo(function TwaGameView({
  colony,
  colonyLoading,
  colonyId,
  resources,
  resourcesLoading,
  userEmail,
  buildings,
  onBuild,
  onDemolish,
  onRefresh,
  onLogout,
  onCreateEvent,
  onToast,
}: TwaGameViewProps) {
  const [activeTab, setActiveTab] = useState('resources')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'resources':
        return (
          <div className="space-y-4">
            <ColonyPanel colony={colony} loading={colonyLoading} />
            <ResourcePanel resources={resources} loading={resourcesLoading} />
          </div>
        )
      case 'buildings':
        return (
          <BuildingsPanel
            buildings={buildings}
            colonyId={colonyId}
            resources={resources}
            onBuild={onBuild}
            onDemolish={onDemolish}
            onRefresh={onRefresh}
          />
        )
      case 'map':
        return <GameMapPanel colonyId={colonyId} onDiscover={onRefresh} />
      case 'events':
        return <EventsPanel colonyId={colonyId} onCreateTest={onCreateEvent} />
      case 'pvp':
        return <PvpPanel colonyId={colonyId} onResult={onToast} />
      case 'leaderboard':
        return <LeaderboardPanel />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-16">
      <header className="bg-gray-800 p-3 shadow-lg sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">🚀 Mars2050</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{colony?.name} — Ур.{colony?.level || 1}</span>
            <button onClick={onLogout} className="bg-red-600 px-2 py-1 rounded text-white text-xs">Выйти</button>
          </div>
        </div>
      </header>

      <main className="p-3">
        {renderTabContent()}
      </main>

      <GameTabs activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
})
