'use client'

import { useState, Suspense, lazy, useCallback, useRef } from 'react'
import { ColonyPanel } from '@/components/game/ColonyPanel'
import { BuildingActionModal } from '@/components/game/BuildingActionModal'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'

// Lazy load the heavy PixiJS component
const ColonyCanvas = lazy(() => import('./ColonyCanvas').catch(() => ({
  default: () => <ColonyPanelFallback message="Ошибка загрузки графического движка" />
})))

interface ColonyScreenProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[]
  resources: ResourceRow[]
  resourcesLoading: boolean
  onLogout: () => void
  onDemolish: (id: string) => Promise<void>
  placementMode?: BuildingTypeKey | null
  setPlacementMode?: (type: BuildingTypeKey | null) => void
  onBuild?: (type: BuildingTypeKey, x: number, y: number) => Promise<void>
  children?: React.ReactNode
}
/**
 * Enhanced Colony Screen with Isometric PixiJS view.
 * Falls back to traditional UI if WebGL is not supported.
 */
export default function ColonyScreen({ 
  colony, 
  colonyLoading, 
  buildings,
  onLogout,
  onDemolish,
  placementMode,
  setPlacementMode,
  onBuild,
  children 
}: Omit<ColonyScreenProps, 'colonyId' | 'resources' | 'resourcesLoading'>) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRow | null>(null)
  const isBuildingRef = useRef(false)
  
  const handleConfirmPlacement = useCallback(async (x: number, y: number) => {
    if (isBuildingRef.current) return
    if (!placementMode || !onBuild) return
    
    isBuildingRef.current = true
    const currentMode = placementMode
    if (setPlacementMode) setPlacementMode(null) // clear synchronously to prevent double click
    
    try {
      await onBuild(currentMode, x, y)
      // Do NOT reset isBuildingRef here!
      // If it succeeded, placementMode becomes null in the UI.
      // We want this function locked forever for this closure.
      // The parent will re-render and pass a NEW handleConfirmPlacement 
      // with a NEW isBuildingRef.current = false if they re-enter placement mode.
    } catch (e) {
      if (setPlacementMode) setPlacementMode(currentMode) // restore if failed
      isBuildingRef.current = false // Only unlock if it failed, so they can try again
    }
  }, [placementMode, onBuild, setPlacementMode])

  const [supportsWebGL] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const canvas = document.createElement('canvas')
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
    } catch {
      return false
    }
  })

  if (supportsWebGL === false) {
    return (
      <div className="p-4 space-y-4 overflow-y-auto h-full">
        <ColonyPanel colony={colony} loading={colonyLoading} />
        <ColonyPanelFallback message="WebGL не поддерживается" />
        <div className="bg-gray-800 p-4 rounded-lg">
           <h3 className="text-white font-bold mb-2">Статистика</h3>
           <div className="flex justify-between text-gray-400">
              <span>Здания:</span>
              <span className="text-white">{children}</span>
           </div>
           <button 
             onClick={onLogout}
             className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white py-2 rounded"
           >
             Выйти
           </button>
        </div>
      </div>
    )
  }

  if (supportsWebGL === null) {
    return <div className="flex items-center justify-center h-full text-white">Инициализация...</div>
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <Suspense fallback={<div className="flex items-center justify-center h-full text-white">Загрузка колонии...</div>}>
        <ColonyCanvas 
          colony={colony}
          buildings={buildings} 
          onBuildingClick={setSelectedBuilding} 
          placementMode={placementMode ?? null}
          onConfirmPlacement={handleConfirmPlacement}
        />
      </Suspense>

      {colony && (
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="hud-panel px-4 py-2">
            <p className="text-white font-semibold leading-tight">{colony.name}</p>
            <p className="text-xs text-cyan-300">Уровень {colony.level}</p>
          </div>
        </div>
      )}
      
      {/* Children overlay */}
      {children && (
        <div className="absolute top-4 left-4 right-4 pointer-events-none">
          <div className="mt-4 pointer-events-auto">
            {children}
          </div>
        </div>
      )}

      <BuildingActionModal 
        building={selectedBuilding} 
        onClose={() => setSelectedBuilding(null)} 
        onDemolish={onDemolish} 
      />
    </div>
  )
}

function ColonyPanelFallback({ message }: { message: string }) {
  return (
    <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg text-white">
      <p className="font-bold">Внимание</p>
      <p className="text-sm opacity-80">{message}. Переключение в упрощенный режим.</p>
    </div>
  )
}
