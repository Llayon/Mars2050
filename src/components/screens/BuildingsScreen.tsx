'use client'

import { memo, useState, useCallback } from 'react'
import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingTypeKey, BuildingRow } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import { RESOURCE_NAMES } from '@/domains/resource/resource.types'
import { ResourcesBar } from './ResourcesBar'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal } from '@/components/ui/modal'

interface BuildingsScreenProps {
  buildings: BuildingRow[]
  colonyId: string
  resources: ResourceRow[]
  resourcesLoading: boolean
  onBuild: (type: BuildingTypeKey) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onRefresh: () => void
}

const BUILDING_LEVEL_COLORS = ['text-gray-400', 'text-green-400', 'text-blue-400', 'text-purple-400', 'text-yellow-400', 'text-red-400']

export const BuildingsScreen = memo(function BuildingsScreen({
  buildings,
  colonyId,
  resources,
  resourcesLoading,
  onBuild,
  onDemolish,
  onRefresh,
}: BuildingsScreenProps) {
  const [showBuildMenu, setShowBuildMenu] = useState(false)
  const [building, setBuilding] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingRow | null>(null)
  const [demolishTarget, setDemolishTarget] = useState<BuildingRow | null>(null)
  const { toast } = useToast()

  const handleBuild = useCallback(async (type: BuildingTypeKey) => {
    const config = BUILDING_TYPES[type]
    if (!config) return
    const canAfford = Object.entries(config.cost).every(([k, v]) => {
      const res = resources.find(r => r.type === k)
      return res && res.amount >= v
    })
    if (!canAfford) {
      toast('Недостаточно ресурсов', 'error')
      return
    }
    setBuilding(type)
    try {
      await onBuild(type)
      await onRefresh()
      toast(`${config.name} построен!`, 'success')
      setShowBuildMenu(false)
    } catch (e: any) {
      toast(e.message || 'Ошибка строительства', 'error')
    } finally {
      setBuilding(null)
    }
  }, [resources, onBuild, onRefresh, toast])

  const handleDemolish = useCallback(async () => {
    if (!demolishTarget) return
    try {
      await onDemolish(demolishTarget.id)
      await onRefresh()
      toast(`${demolishTarget.name} снесён`, 'success')
    } catch (e: any) {
      toast(e.message || 'Ошибка сноса', 'error')
    }
    setDemolishTarget(null)
    setSelectedBuilding(null)
  }, [demolishTarget, onDemolish, onRefresh, toast])

  const buildingConfigs = Object.entries(BUILDING_TYPES)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 pb-0">
        <ResourcesBar resources={resources} loading={resourcesLoading} />
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-24">
        <div className="grid grid-cols-2 gap-2">
          {buildings.length === 0 && (
            <div className="col-span-2 glass-panel rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">Зданий пока нет</p>
              <button
                onClick={() => setShowBuildMenu(true)}
                className="bg-mars-red hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm transition-colors"
              >
                Построить первое здание
              </button>
            </div>
          )}

          {buildings.map(b => {
            const lvlColor = BUILDING_LEVEL_COLORS[Math.min(b.level, BUILDING_LEVEL_COLORS.length - 1)]
            return (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBuilding(prev => prev?.id === b.id ? null : b)
                }}
                className={`glass-panel rounded-xl p-3 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  selectedBuilding?.id === b.id ? 'ring-2 ring-mars-orange glow-gold' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg leading-none">{BUILDING_TYPES[b.type as BuildingTypeKey]?.name.charAt(0) || '🏗'}</span>
                  <span className={`text-xs font-bold ${lvlColor}`}>Lv.{b.level}</span>
                </div>
                <p className="text-sm font-semibold text-white truncate">{b.name}</p>
                <p className="text-xs text-gray-400">{b.is_active ? '✅ Активно' : '⛔ Неактивно'}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selectedBuilding && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSelectedBuilding(null)}>
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative w-full glass-panel rounded-t-2xl p-4 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">{selectedBuilding.name}</h3>
            <p className="text-xs text-gray-400 mb-3">
              Уровень {selectedBuilding.level} • {selectedBuilding.is_active ? '✅ Активно' : '⛔ Неактивно'}
            </p>
            <div className="space-y-1 mb-4">
              <p className="text-xs text-gray-400">Производство:</p>
              {Object.entries(BUILDING_TYPES[selectedBuilding.type as BuildingTypeKey]?.production || {}).map(([k, v]) => (
                <p key={k} className="text-sm text-green-400">+{v} {RESOURCE_NAMES[k] || k}/ч</p>
              ))}
            </div>
            <button
              onClick={() => setDemolishTarget(selectedBuilding)}
              className="w-full bg-red-600/20 border border-red-600/40 text-red-400 py-2.5 rounded-xl text-sm font-medium hover:bg-red-600/30 transition-colors"
            >
              Снести здание
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowBuildMenu(!showBuildMenu)}
        className="fixed right-4 bottom-20 z-30 w-14 h-14 bg-mars-red rounded-full flex items-center justify-center text-2xl shadow-lg glow-red hover:scale-110 active:scale-95 transition-all duration-200"
      >
        {showBuildMenu ? '✕' : '+'}
      </button>

      {showBuildMenu && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setShowBuildMenu(false)}>
          <div className="fixed inset-0 bg-black/60" />
          <div
            className="relative w-full glass-panel rounded-t-2xl p-4 pb-8 max-h-[70vh] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-3">Постройка</h3>
            <div className="space-y-2 overflow-y-auto max-h-[55vh]">
              {buildingConfigs.map(([type, config]) => {
                const canAfford = Object.entries(config.cost).every(([k, v]) => {
                  const res = resources.find(r => r.type === k)
                  return res && res.amount >= v
                })
                const exists = buildings.some(b => b.type === type)
                return (
                  <button
                    key={type}
                    onClick={() => handleBuild(type as BuildingTypeKey)}
                    disabled={building !== null}
                    className={`w-full text-left glass-panel-light rounded-xl p-3 transition-all duration-200 ${
                      canAfford ? 'hover:bg-white/5' : 'opacity-50'
                    } ${exists ? 'ring-1 ring-mars-teal/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">{config.name}</p>
                      {exists && <span className="text-[10px] text-mars-teal">Построено</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Стоимость: {Object.entries(config.cost).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}`).join(', ')}
                    </p>
                    <p className="text-xs text-green-400/80">
                      +{Object.entries(config.production).map(([k, v]) => `${v} ${RESOURCE_NAMES[k] || k}/ч`).join(', ')}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={demolishTarget !== null}
        onClose={() => setDemolishTarget(null)}
        onConfirm={handleDemolish}
        title="Снос здания"
        message={`Вы уверены, что хотите снести «${demolishTarget?.name}»?`}
        confirmText="Снести"
        danger
      />
    </div>
  )
})
