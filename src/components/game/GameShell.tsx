'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { useBuildings } from '@/hooks/useBuildings'
import { useColony } from '@/hooks/useColony'
import { useColonyBootstrap } from '@/hooks/useColonyBootstrap'
import { usePopulation } from '@/hooks/usePopulation'
import { useResources } from '@/hooks/useResources'
import { useToast } from '@/components/ui/toast'
import type { TabId } from '@/components/screens/BottomNav'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingSettingsUpdate, BuildingTypeKey } from '@/domains/building/building.types'

const TwaHud = dynamic(() => import('@/components/game/TwaHud').then(mod => mod.TwaHud), {
  ssr: false,
  loading: () => null
})

const DesktopHud = dynamic(() => import('@/components/game/DesktopHud').then(mod => mod.DesktopHud), {
  ssr: false,
  loading: () => null
})

interface GameShellUser {
  id: string
  email?: string
}

export interface GameShellProps {
  user: GameShellUser | null
  colonyId: string
  isTWA: boolean
  tgUser?: { id: number; first_name: string; username?: string } | null
  onLogout: () => void
}

export function GameShell({ user, colonyId, isTWA, tgUser, onLogout }: GameShellProps) {
  const bootstrap = useColonyBootstrap(colonyId)
  const fallbackEnabled = !bootstrap.loading && !bootstrap.data
  const { colony, loading: colonyLoading } = useColony(colonyId, { initialData: bootstrap.data?.colony, enabled: fallbackEnabled })
  const { resources, loading: resourcesLoading } = useResources(colonyId, { initialData: bootstrap.data?.resources, enabled: fallbackEnabled })
  const { buildings, buildStructure, demolishBuilding, updateBuildingSettings } = useBuildings(colonyId, { initialData: bootstrap.data?.buildings, enabled: fallbackEnabled })
  const { population, upgradeTier, loading: populationLoading } = usePopulation(colonyId, { initialData: bootstrap.data?.population, enabled: fallbackEnabled })
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabId>('colony')
  const [viewMode, setViewMode] = useState<'colony' | 'map'>('colony')
  const [placementMode, setPlacementMode] = useState<BuildingTypeKey | null>(null)

  const handleBuild = useCallback(async (type: BuildingTypeKey, x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      try {
        await buildStructure(type, x, y)
        const config = BUILDING_TYPES[type]
        if (config) toast(`${config.name} построен!`, 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err), 'error')
        throw err
      }
      return
    }

    setPlacementMode(type)
    if (isTWA) setActiveTab('colony')
  }, [buildStructure, isTWA, toast])

  const handleDemolish = useCallback((id: string) => demolishBuilding(id), [demolishBuilding])

  const handleUpdateSettings = useCallback(async (id: string, settings: BuildingSettingsUpdate) => {
    try {
      await updateBuildingSettings(id, settings)
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
      throw err
    }
  }, [updateBuildingSettings, toast])

  if (isTWA) {
    return (
      <TwaHud
        colonyId={colonyId}
        colony={colony}
        colonyLoading={bootstrap.loading || colonyLoading}
        buildings={buildings}
        resources={resources}
        resourcesLoading={bootstrap.loading || resourcesLoading}
        userEmail={user?.email}
        userId={user?.id}
        tgUser={tgUser}
        isTWA={isTWA}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        placementMode={placementMode}
        setPlacementMode={setPlacementMode}
        onBuild={handleBuild}
        onDemolish={handleDemolish}
        onUpdateSettings={handleUpdateSettings}
        onLogout={onLogout}
        population={population}
        populationLoading={bootstrap.loading || populationLoading}
        onUpgradePopulation={upgradeTier}
      />
    )
  }

  return (
    <DesktopHud
      colonyId={colonyId}
      colony={colony}
      colonyLoading={bootstrap.loading || colonyLoading}
      buildings={buildings}
      resources={resources}
      resourcesLoading={bootstrap.loading || resourcesLoading}
      userEmail={user?.email}
      userId={user?.id}
      tgUser={tgUser}
      isTWA={isTWA}
      viewMode={viewMode}
      setViewMode={setViewMode}
      placementMode={placementMode}
      setPlacementMode={setPlacementMode}
      onBuild={handleBuild}
      onDemolish={handleDemolish}
      onUpdateSettings={handleUpdateSettings}
      onPvpResult={(msg) => toast(msg, 'info')}
      onLogout={onLogout}
      population={population}
      populationLoading={bootstrap.loading || populationLoading}
      onUpgradePopulation={upgradeTier}
    />
  )
}
